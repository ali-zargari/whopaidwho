#!/usr/bin/env python3
"""Build audited, cycle-specific FEC independent-expenditure snapshots.

Uses the FEC's processed periodic aggregates, not sums of raw rapid notices.
FEC_API_KEY is optional; the public DEMO_KEY has lower rate limits. A failed or
inconsistent download never replaces an existing snapshot. Cached public API
responses make an interrupted import resumable without persisting credentials.
"""
import argparse
from collections import defaultdict
import csv
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import io
import json
import os
from pathlib import Path
import re
import ssl
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
API = "https://api.open.fec.gov/v1/"
AGGREGATES = "schedules/schedule_e/by_candidate/"
TOTALS = "schedules/schedule_e/totals/by_candidate/"
SCHEMA_VERSION = 1
CANDIDATE_ID = re.compile(r"^[HSP]\d[A-Z0-9]{7}$")
COMMITTEE_ID = re.compile(r"^C\d{8}$")
METHODOLOGY_SOURCE = "https://api.open.fec.gov/developers/"
SQL_SOURCE = "https://github.com/fecgov/openFEC/blob/65d9c7d0535a6c9b0e26a8215853f8bb77ed7aac/data/migrations/V0119__update_sched_c_d_e_f_and_related_tables.sql"


def now():
    return datetime.now(timezone.utc).isoformat()


def digest(raw):
    return hashlib.sha256(raw).hexdigest()


def money(value):
    """Keep cent precision and reject missing, non-finite or sub-cent amounts."""
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, ValueError) as error:
        raise ValueError("Invalid FEC monetary amount") from error
    if not amount.is_finite() or amount != amount.quantize(Decimal("0.01")):
        raise ValueError("Invalid FEC monetary precision")
    return int(amount * 100)


def dollars(cents):
    return round(cents / 100, 2)


class SourceClient:
    def __init__(self, cache_dir, fresh=False, public_website=False):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.fresh = fresh
        self.public_website = public_website
        self.next_api_request_at = 0.0
        self.key = os.environ.get("FEC_API_KEY")
        self.context = ssl.create_default_context(cafile="/etc/ssl/cert.pem" if Path("/etc/ssl/cert.pem").exists() else None)
        if public_website:
            # FEC deliberately publishes this client configuration for public
            # website data access. It is kept in memory, never in provenance,
            # logs, source code or cache. Do not rotate credentials on a 429.
            request = urllib.request.Request("https://www.fec.gov/data/independent-expenditures/", headers={"User-Agent": "WhoPaidWho/1.0 (public FEC data explorer)"})
            with urllib.request.urlopen(request, timeout=60, context=self.context) as response:
                page = response.read().decode()
            match = re.search(r"\bAPI_KEY_PUBLIC\s*=\s*['\"]([A-Za-z0-9_-]+)['\"]", page)
            if not match:
                raise RuntimeError("FEC public website client configuration unavailable; set FEC_API_KEY.")
            self.key = match.group(1)
        if not self.key:
            local_env = ROOT / ".env.local"
            if local_env.exists():
                for line in local_env.read_text().splitlines():
                    match = re.fullmatch(r"\s*(?:export\s+)?FEC_API_KEY\s*=\s*(.*?)\s*", line)
                    if match:
                        self.key = match.group(1).strip("\"'")
                        break
        self.key = self.key or "DEMO_KEY"

    def fetch(self, public_url, api=False, force=False):
        cache_path = self.cache_dir / f"{digest(public_url.encode())}.json"
        if not self.fresh and not force and cache_path.exists():
            cached = json.loads(cache_path.read_text())
            age = datetime.now(timezone.utc) - datetime.fromisoformat(cached["fetchedAt"])
            raw_path = cache_path.with_suffix(".body")
            if age < timedelta(hours=6) and raw_path.exists():
                raw = raw_path.read_bytes()
                if digest(raw) == cached["sha256"]:
                    return raw, cached
        request_url = public_url
        if api:
            request_url += ("&" if "?" in request_url else "?") + urllib.parse.urlencode({"api_key": self.key})
        headers = {"User-Agent": "WhoPaidWho/1.0 (public FEC data explorer)"}
        if api and self.public_website:
            # This published key is scoped to the public FEC website client.
            headers.update({"Origin": "https://www.fec.gov", "Referer": "https://www.fec.gov/data/independent-expenditures/"})
        request = urllib.request.Request(request_url, headers=headers)
        for attempt in range(3):
            try:
                if api:
                    time.sleep(max(0, self.next_api_request_at - time.monotonic()))
                    self.next_api_request_at = time.monotonic() + 0.25
                with urllib.request.urlopen(request, timeout=90, context=self.context) as response:
                    raw = response.read()
                break
            except urllib.error.HTTPError as error:
                # Do not print URLs or error bodies: they could contain an API key.
                if error.code == 429:
                    raise RuntimeError("FEC API rate limit reached. Cached pages are retained; retry later or set FEC_API_KEY.") from None
                if error.code not in (500, 502, 503, 504) or attempt == 2:
                    raise RuntimeError(f"FEC source returned HTTP {error.code} for a public data request.") from None
                time.sleep(2 ** attempt)
            except (TimeoutError, urllib.error.URLError):
                if attempt == 2:
                    raise RuntimeError("FEC source could not be reached; existing snapshots are unchanged.") from None
                time.sleep(2 ** attempt)
        metadata = {"url": public_url, "fetchedAt": now(), "sha256": digest(raw), "bytes": len(raw)}
        cache_path.with_suffix(".body").write_bytes(raw)
        cache_path.write_text(json.dumps(metadata))
        return raw, metadata

    def pages(self, endpoint, cycle):
        params = [("cycle", cycle), ("election_full", "false"), ("per_page", 100)]
        # The spender view exposes its unique materialized-view index as a sort
        # key. Candidate totals use both grouping keys for deterministic paging.
        sorts = ["idx"] if endpoint == AGGREGATES else ["candidate_id", "support_oppose_indicator"]
        params.extend(("sort", value) for value in sorts)

        def page(number, force=False):
            url = API + endpoint + "?" + urllib.parse.urlencode(params + [("page", number)])
            raw, provenance = self.fetch(url, api=True, force=force)
            data = json.loads(raw)
            if not isinstance(data.get("results"), list):
                raise ValueError("FEC response lacks a results array")
            return data, provenance

        first, source = page(1)
        count, pages = validate_pagination(first["pagination"], 1)
        rows, sources = list(first["results"]), [source]
        # Serial requests keep the public service load modest; rate limits are
        # a hard stop and cached pages make a later retry resumable.
        for number in range(2, pages + 1):
            data, provenance = page(number)
            if validate_pagination(data["pagination"], number) != (count, pages):
                raise ValueError("FEC aggregate changed during pagination; retry a fresh import")
            rows.extend(data["results"])
            sources.append(provenance)
        if len(rows) != count:
            raise ValueError("Incomplete FEC pagination; refusing replacement")
        # This is not a transactional API. Re-check the first page and count
        # after the sweep; row uniqueness and total reconciliation below catch
        # skipped/overlapping pages or material refreshes mid-download.
        last_first, last_source = page(1, force=True)
        if validate_pagination(last_first["pagination"], 1) != (count, pages) or last_first["results"] != first["results"]:
            raise ValueError("FEC aggregate changed during download; retry a fresh import")
        sources.append(last_source)
        return rows, sources


def validate_pagination(pagination, page):
    count, pages = pagination.get("count"), pagination.get("pages")
    if (pagination.get("is_count_exact") is not True or not isinstance(count, int)
            or count < 0 or not isinstance(pages, int) or pages < 0
            or pagination.get("page") != page or pagination.get("per_page") != 100
            or pages != (count + 99) // 100):
        raise ValueError("Unexpected or approximate FEC aggregate pagination")
    return count, pages


def committee_registry(raw):
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        names = [name for name in archive.namelist() if name.endswith(".txt")]
        if len(names) != 1:
            raise ValueError("Unexpected FEC committee archive")
        with archive.open(names[0]) as stream:
            result = {}
            for row in csv.reader(io.TextIOWrapper(stream, encoding="utf-8-sig", errors="replace"), delimiter="|"):
                if len(row) != 15:
                    raise ValueError("Unexpected FEC committee registry schema")
                result[row[0]] = {"name": row[1], "committeeType": row[9] or None, "organizationType": row[12] or None, "connectedOrganization": row[13] or None}
            return result


def notice_names(raw):
    """Use notice data ONLY to resolve names, never as expenditure totals."""
    records = csv.DictReader(io.StringIO(raw.decode("utf-8-sig", errors="replace")))
    headers = records.fieldnames or []
    normalized = {key.upper(): key for key in headers}
    id_key, name_key = normalized.get("SPE_ID"), normalized.get("SPE_NAM")
    if not id_key or not name_key:
        raise ValueError("Unexpected FEC notice CSV name columns")
    names = defaultdict(set)
    for row in records:
        if row[id_key] and row[name_key]:
            names[row[id_key]].add(row[name_key].strip())
    # Do not arbitrarily select a name when historical notices disagree.
    return {key: next(iter(values)) for key, values in names.items() if len(values) == 1}


def candidate_ids(cycle):
    snapshot = json.loads((ROOT / "src/data/fec" / f"{cycle}.json").read_text())
    return {row["id"] for row in snapshot["candidates"] + snapshot.get("registrations", [])}


def build_candidates(cycle, aggregates, totals, indexed_ids, committees=None, names=None):
    committees, names = committees or {}, names or {}
    entries = defaultdict(lambda: {"support": 0, "oppose": 0, "spenders": {}})
    seen = set()
    excluded = []
    for row in aggregates:
        if row.get("cycle") != cycle:
            raise ValueError("FEC aggregate returned an incorrect cycle")
        candidate, spender, stance = row.get("candidate_id"), row.get("committee_id"), row.get("support_oppose_indicator")
        key = (candidate, spender, stance)
        amount = money(row.get("total"))
        count = row.get("count")
        if not isinstance(count, int) or count < 0:
            raise ValueError("Invalid FEC aggregate transaction count")
        if not isinstance(candidate, str) or not CANDIDATE_ID.fullmatch(candidate) or stance not in ("S", "O"):
            excluded.append({"candidateId": candidate, "spenderId": spender, "stance": stance, "amount": dollars(amount), "reason": "unresolved-candidate-or-stance"})
            continue
        if key in seen:
            raise ValueError("Duplicate aggregate key; pagination is inconsistent")
        seen.add(key)
        # Missing spender IDs cannot be relabeled as a real named committee.
        # Retain the total under an explicit unknown source so reconciliation
        # still holds. Unknown source keys cannot collide with real C IDs.
        if spender is not None and (not isinstance(spender, str) or not COMMITTEE_ID.fullmatch(spender)):
            raise ValueError("Unexpected FEC spender ID")
        spender_key = spender or "UNKNOWN"
        committee = committees.get(spender, {})
        target = entries[candidate]
        side = "support" if stance == "S" else "oppose"
        target[side] += amount
        item = target["spenders"].setdefault(spender_key, {
            "id": spender_key, "name": row.get("committee_name") or committee.get("name") or names.get(spender) or spender or "Unidentified filer",
            "committeeType": committee.get("committeeType"), "organizationType": committee.get("organizationType"),
            "connectedOrganization": committee.get("connectedOrganization"),
            "support": 0, "oppose": 0, "supportCount": 0, "opposeCount": 0,
        })
        item[side] += amount
        item[side + "Count"] += count
    total_keys = set()
    checked = 0
    for row in totals:
        if row.get("cycle") != cycle:
            raise ValueError("FEC candidate total returned an incorrect cycle")
        candidate, stance = row.get("candidate_id"), row.get("support_oppose_indicator")
        key = (candidate, stance)
        if key in total_keys:
            raise ValueError("Duplicate FEC candidate total")
        total_keys.add(key)
        if not isinstance(candidate, str) or not CANDIDATE_ID.fullmatch(candidate) or stance not in ("S", "O"):
            continue
        side = "support" if stance == "S" else "oppose"
        if entries[candidate][side] != money(row.get("total")):
            raise ValueError(f"Candidate totals fail reconciliation: {candidate} {stance}")
        checked += 1
    for candidate, entry in entries.items():
        if candidate in indexed_ids:
            for side, stance in (("support", "S"), ("oppose", "O")):
                has_records = any(item[side + "Count"] for item in entry["spenders"].values())
                if has_records and (candidate, stance) not in total_keys:
                    raise ValueError(f"Indexed candidate missing from FEC totals: {candidate} {stance}")
    candidates = {}
    # Source-matched congressional candidates absent from the app's finance
    # table are retained, making incoming registrations usable without edits.
    all_ids = indexed_ids | {key for key in entries if key.startswith(("H", "S"))}
    for candidate in sorted(all_ids):
        entry = entries[candidate]
        spenders = list(entry["spenders"].values())
        spenders.sort(key=lambda item: (-(item["support"] + item["oppose"]), item["id"]))
        for item in spenders:
            item["support"], item["oppose"] = dollars(item["support"]), dollars(item["oppose"])
        candidates[candidate] = {
            "support": dollars(entry["support"]), "oppose": dollars(entry["oppose"]),
            "status": "reported" if spenders else "no-reported-spending", "spenders": spenders,
        }
    audit = {"aggregateRows": len(aggregates), "totalRows": len(totals), "candidateStancesReconciled": checked,
             "indexedCandidates": len(indexed_ids), "congressionalCandidates": len(candidates),
             "candidatesWithSpending": sum(bool(row["spenders"]) for row in candidates.values()),
             "uniqueSpenders": len({item["id"] for row in candidates.values() for item in row["spenders"]}),
             "unresolvedRowCount": len(excluded),
             "unresolvedNetAmount": dollars(sum(money(row["amount"]) for row in excluded)),
             "excludedUnresolvedRows": excluded}
    return candidates, audit


def refresh(cycle, client):
    aggregates, aggregate_sources = client.pages(AGGREGATES, cycle)
    totals, total_sources = client.pages(TOTALS, cycle)
    committee_url = f"https://www.fec.gov/files/bulk-downloads/{cycle}/cm{str(cycle)[-2:]}.zip"
    notice_url = f"https://www.fec.gov/files/bulk-downloads/{cycle}/independent_expenditure_{cycle}.csv"
    committee_raw, committee_source = client.fetch(committee_url)
    notice_raw, notice_source = client.fetch(notice_url)
    candidates, audit = build_candidates(cycle, aggregates, totals, candidate_ids(cycle), committee_registry(committee_raw), notice_names(notice_raw))
    if audit["indexedCandidates"] < 500 or audit["candidatesWithSpending"] < 50:
        raise ValueError("Unexpectedly incomplete outside spending coverage")
    sources = aggregate_sources + total_sources + [committee_source, notice_source]
    return {
        "schemaVersion": SCHEMA_VERSION, "cycle": cycle, "downloadedAt": max(source["fetchedAt"] for source in sources),
        "downloadStartedAt": min(source["fetchedAt"] for source in sources),
        "coverage": {
            "status": "processed-periodic-filings", "nonCommitteeForm5Included": True, "rapidNoticesIncluded": False,
            "periodStart": f"{cycle - 1}-01-01", "periodEnd": f"{cycle}-12-31", "coverageEnd": None,
            "description": "FEC processed independent-expenditure aggregates for the two-year reporting cycle, including periodic Schedule E and Form 5 records. Support and opposition are separate net amounts.",
            "limitations": [
                "24- and 48-hour notices are excluded from these totals to avoid counting spending again when it appears in periodic reports. Recent spending may not appear until periodic reports are processed.",
                "Downloaded date is the retrieval time, not a common reporting cutoff. The FEC aggregate does not expose a single coverage-end date.",
                "These are reported independent expenditures, not all political advertising or a measure of corruption or coordination. Unreported spending and issue advertising outside FEC reporting are not measured.",
                "A named spender is not necessarily the original source of its money. Form 5 inclusion does not establish the filer's tax status or original-donor disclosure.",
                "No-reported-spending means no matched processed periodic aggregate in this snapshot; it does not establish that no spending occurred.",
                "Source rows without an identifiable candidate or support/oppose indicator are retained in the import audit but cannot be attributed to a candidate. Their count and net amount are published in the audit.",
            ],
        },
        "source": API + AGGREGATES, "totalsSource": API + TOTALS,
        "methodologySource": METHODOLOGY_SOURCE, "aggregationSqlSource": SQL_SOURCE,
        "sources": sources, "audit": audit, "candidates": candidates,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cycles", nargs="+", type=int, default=[2024, 2026])
    parser.add_argument("--cache-dir", default=str(Path(tempfile.gettempdir()) / "wpw-outside-cache"))
    parser.add_argument("--fresh", action="store_true", help="Ignore cached responses")
    parser.add_argument("--public-website", action="store_true", help="Use FEC's explicitly published public website client configuration")
    args = parser.parse_args()
    if any(cycle < 2010 or cycle % 2 for cycle in args.cycles):
        parser.error("Cycles must be even years from 2010 onward")
    client = SourceClient(args.cache_dir, args.fresh, args.public_website)
    pending = []
    for cycle in args.cycles:
        print(f"{cycle}: downloading processed FEC independent-expenditure aggregates", flush=True)
        snapshot = refresh(cycle, client)
        pending.append((ROOT / "src/data/influence" / f"outside-{cycle}.json", snapshot))
        print(f"{cycle}: {snapshot['audit']['candidatesWithSpending']:,} congressional candidates, {snapshot['audit']['uniqueSpenders']:,} spenders; all candidate totals reconciled", flush=True)
    # Validate every requested cycle before publishing any replacement.
    for path, snapshot in pending:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(".tmp")
        temporary.write_text(json.dumps(snapshot, separators=(",", ":"), ensure_ascii=False) + "\n")
        temporary.replace(path)
    print("Outside-spending snapshots saved. Rebuild to publish them.")


if __name__ == "__main__":
    main()
