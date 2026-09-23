#!/usr/bin/env python3
"""Aggregate reported personal-contribution affiliations from official FEC bulk data.

The multi-GB archives are streamed, CRC checked and SHA-256 hashed without being
written to disk. The optional local cache contains only the filtered analytical
columns, never contributor names or addresses. See docs/affiliation-sources.md.
"""
import argparse
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from decimal import Decimal, InvalidOperation
from email.utils import parsedate_to_datetime
import gzip
import hashlib
import io
import json
from pathlib import Path
import re
import ssl
import struct
import time
import urllib.request
import zipfile
import zlib

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://www.fec.gov/files/bulk-downloads'
CONTEXT = ssl.create_default_context(cafile='/etc/ssl/cert.pem' if Path('/etc/ssl/cert.pem').exists() else None)
USER_AGENT = 'WhoPaidWho/1.0 (public campaign-finance research; github.com/ali-zargari/whopaidwho)'
MISSING = {'', 'NONE', 'N/A', 'NA', 'NULL', 'UNKNOWN', 'NOT PROVIDED', 'NOT AVAILABLE', 'UNAVAILABLE',
           'NOT GIVEN', 'NOT DISCLOSED', 'DECLINED TO PROVIDE', 'NO EMPLOYER PROVIDED', 'INFORMATION REQUESTED',
           'INFORMATION REQUESTED PER BEST EFFORTS', 'INFORMATION REQUESTED BEST EFFORTS', 'INFO REQUESTED',
           'REQUESTED', 'UNREPORTED', 'NOT REPORTED', 'DECLINED', 'REFUSED'}
KEEP = [0, 1, 2, 4, 5, 6, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]


def open_url(url):
    request = urllib.request.Request(url, headers={'User-Agent': USER_AGENT})
    return urllib.request.urlopen(request, context=CONTEXT, timeout=120)


def small_zip(cycle, kind):
    url = f'{BASE}/{cycle}/{kind}{str(cycle)[-2:]}.zip'
    with open_url(url) as response:
        body = response.read()
        source = dict(url=url, sha256=hashlib.sha256(body).hexdigest(),
                      lastModified=response.headers.get('Last-Modified'), fetchedAt=datetime.now(timezone.utc).isoformat())
    with zipfile.ZipFile(io.BytesIO(body)) as archive:
        filename = next(n for n in archive.namelist() if n.endswith('.txt'))
        rows = [line.split('|') for line in archive.read(filename).decode('utf-8-sig', errors='replace').splitlines()]
    return rows, source


def committee_links(cycle, candidates):
    links = defaultdict(set)
    for candidate in candidates:
        if candidate.get('principalCommitteeId'):
            links[candidate['principalCommitteeId']].add(candidate['id'])
    ids = {c['id'] for c in candidates}
    sources = []
    for kind in ['cm', 'ccl']:
        rows, source = small_zip(cycle, kind)
        sources.append(source)
        for row in rows:
            if kind == 'cm':
                if len(row) != 15:
                    raise ValueError('Committee master schema changed')
                if row[8] in ('P', 'A') and row[14]:
                    links[row[0]].add(row[14])
            else:
                if len(row) != 7:
                    raise ValueError('Candidate/committee linkage schema changed')
                if row[0] and row[2] == str(cycle) and row[5] in ('P', 'A'):
                    links[row[3]].add(row[0])
    # Presidential/nonfinancial IDs must still participate in ambiguity checks:
    # a shared committee cannot be assigned just because only one ID is in this UI.
    ambiguous = sorted(c for c, candidate_ids in links.items() if len(candidate_ids) != 1 and candidate_ids & ids)
    return {c: next(iter(candidate_ids)) for c, candidate_ids in links.items()
            if len(candidate_ids) == 1 and candidate_ids & ids}, sources, ambiguous


def stream_archive(url, callback):
    """Read one deflated ZIP member; validate CRC, declared size and full download."""
    sha = hashlib.sha256()
    member_sha = hashlib.sha256()
    with open_url(url) as response:
        total_bytes = 0
        expected_bytes = int(response.headers['Content-Length'])
        metadata = dict(url=url, lastModified=response.headers.get('Last-Modified'),
                        etag=response.headers.get('ETag'), fetchedAt=datetime.now(timezone.utc).isoformat())

        def read(size):
            nonlocal total_bytes
            data = response.read(size)
            total_bytes += len(data)
            sha.update(data)
            return data

        header = read(30)
        signature, _, flags, method, _, _, expected_crc, compressed_size, expected_size, name_len, extra_len = struct.unpack('<4s5H3I2H', header)
        if signature != b'PK\x03\x04' or method != 8 or flags & 9:
            raise ValueError('Unsupported archive format; refusing partial data')
        name = read(name_len).decode()
        extra = read(extra_len)
        if expected_size == 0xffffffff or compressed_size == 0xffffffff:
            offset = 0
            while offset < len(extra):
                tag, length = struct.unpack_from('<HH', extra, offset)
                value = extra[offset + 4:offset + 4 + length]
                if tag == 1:
                    expected_size, compressed_size = struct.unpack_from('<QQ', value)
                    break
                offset += 4 + length
        if name != 'itcont.txt':
            raise ValueError(f'Unexpected ZIP member {name}')
        decompressor = zlib.decompressobj(-15)
        remaining = compressed_size
        crc = size = rows = 0
        pending = b''
        last_progress = time.monotonic()
        while remaining:
            chunk = read(min(4 * 1024 * 1024, remaining))
            if not chunk:
                raise ValueError('Truncated archive')
            remaining -= len(chunk)
            raw = decompressor.decompress(chunk)
            crc = zlib.crc32(raw, crc)
            size += len(raw)
            member_sha.update(raw)
            lines = (pending + raw).split(b'\n')
            pending = lines.pop()
            for line in lines:
                if line:
                    callback(line.rstrip(b'\r'))
                    rows += 1
            if time.monotonic() - last_progress > 30:
                print(f'{name}: {total_bytes / expected_bytes:.0%}; {rows:,} rows inspected', flush=True)
                last_progress = time.monotonic()
        if pending:
            callback(pending.rstrip(b'\r'))
            rows += 1
        if not decompressor.eof or size != expected_size or crc != expected_crc:
            raise ValueError('ZIP member failed integrity check')
        while read(1024 * 1024):
            pass
        if total_bytes != expected_bytes:
            raise ValueError('Full ZIP size did not match HTTP Content-Length')
    return dict(**metadata, sha256=sha.hexdigest(), memberSha256=member_sha.hexdigest(),
                member=name, compressedBytes=total_bytes, uncompressedBytes=size, rows=rows)


def cents(value):
    try:
        number = Decimal(value)
        if not number.is_finite() or number * 100 != (number * 100).to_integral_value():
            return None
        return int(number * 100)
    except InvalidOperation:
        return None


def label(value):
    return re.sub(r'\s+', ' ', value.strip()).upper()


def missing(value):
    return value in MISSING or value.startswith('INFORMATION REQUESTED') or value.startswith('INFO REQUESTED')


def iso_date(value):
    try:
        return datetime.strptime(value, '%m%d%Y').date().isoformat()
    except ValueError:
        return None


def empty_amount():
    return dict(amount=0, positiveAmount=0, negativeAmount=0, count=0)


def add_amount(target, amount):
    target['amount'] += amount
    target['positiveAmount'] += max(0, amount)
    target['negativeAmount'] += min(0, amount)
    target['count'] += 1


def dollars(target):
    return {key: value / 100 if key != 'count' else value for key, value in target.items()}


def main(cycle, cache_dir, force=False):
    snapshot = json.loads((ROOT / 'src/data/fec' / f'{cycle}.json').read_text())
    candidates = snapshot['candidates']
    links, sources, ambiguous = committee_links(cycle, candidates)
    committee_sets = defaultdict(list)
    for committee, candidate in links.items():
        committee_sets[candidate].append(committee)
    selected = {committee.encode() for committee in links}
    cache_dir.mkdir(parents=True, exist_ok=True)
    cache_file = cache_dir / f'filtered-{cycle}.jsonl.gz'
    cache_meta = cache_dir / f'filtered-{cycle}.meta.json'
    link_hash = hashlib.sha256(json.dumps(links, sort_keys=True).encode()).hexdigest()
    cached_meta = json.loads(cache_meta.read_text()) if cache_meta.exists() else {}
    # A stricter/new candidate mapping can reuse a superset of cached committees;
    # it never adds records from an unseen committee or ships the cache itself.
    can_reuse = set(links).issubset(set(cached_meta.get('committeeIds', [])))
    if force or not cache_file.exists() or not cache_meta.exists() or not can_reuse:
        tmp = cache_file.with_suffix('.tmp')
        count = 0
        with gzip.open(tmp, 'wt', encoding='utf-8') as output:
            def callback(line):
                nonlocal count
                if line[:9] not in selected:
                    return
                row = line.decode('utf-8', errors='replace').split('|')
                if len(row) != 21:
                    raise ValueError(f'Unexpected INDIV schema: {len(row)}')
                output.write(json.dumps([row[i] for i in KEEP], ensure_ascii=False) + '\n')
                count += 1
            source = stream_archive(f'{BASE}/{cycle}/indiv{str(cycle)[-2:]}.zip', callback)
        tmp.replace(cache_file)
        with cache_file.open('rb') as cached_stream:
            filtered_sha = hashlib.file_digest(cached_stream, 'sha256').hexdigest()
        cache_meta.write_text(json.dumps(dict(source=source, linkHash=link_hash, committeeIds=sorted(links),
                                             rows=count, filteredSha256=filtered_sha)))
        print(f'{cycle}: cached {count:,} committee-matched analytical rows (no contributor identities)', flush=True)
    metadata = json.loads(cache_meta.read_text())
    with cache_file.open('rb') as cached_stream:
        if hashlib.file_digest(cached_stream, 'sha256').hexdigest() != metadata.get('filteredSha256'):
            raise ValueError('Analytical cache integrity check failed; rerun with --force')
    sources.append(metadata['source'])
    result, diagnostics = aggregate(cache_file, cycle, candidates, committee_sets, links,
                                    as_of=metadata['source']['fetchedAt'][:10])
    output = dict(cycle=cycle, downloadedAt=metadata['source']['fetchedAt'],
                  sourceUpdatedAt=parsedate_to_datetime(metadata['source']['lastModified']).isoformat(),
                  methodologyVersion='reported-personal-affiliations-v1',
                  sources=sources, coverage=dict(candidateCount=len(candidates), linkedCandidateCount=len(committee_sets),
                  ambiguousCommitteeIds=ambiguous, filteredRows=metadata['rows'], sourceRows=metadata['source']['rows'],
                  scope='published-itemized-personal-receipts-subset',
                  amendmentHandling='FEC published bulk extract; unique SUB_ID rows, no guessed transaction-ID amendment merges',
                  **diagnostics), candidates=result)
    destination = ROOT / 'src/data/influence' / f'affiliations-{cycle}.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix('.tmp')
    temporary.write_text(json.dumps(output, separators=(',', ':'), ensure_ascii=False) + '\n')
    temporary.replace(destination)
    print(f'{cycle}: wrote {destination.stat().st_size:,} bytes; {diagnostics}', flush=True)


def aggregate(cache_file, cycle, candidates, committee_sets, links, as_of=None):
    totals = defaultdict(empty_amount)
    employers = defaultdict(lambda: defaultdict(empty_amount))
    occupations = defaultdict(lambda: defaultdict(empty_amount))
    exclusions = defaultdict(Counter)
    dates = defaultdict(set)
    counters = Counter()
    # SUB_ID is the unique FEC row ID. TRAN_ID is only unique within a report;
    # never collapse it across report periods or guess an amendment chain.
    seen = set()
    today = as_of or date.today().isoformat()
    with gzip.open(cache_file, 'rt', encoding='utf-8') as stream:
        for line in stream:
            row = json.loads(line)
            committee, amendment, report_type, image, transaction_type, entity, employer, occupation, raw_date, amount, other, transaction, file_number, memo, memo_text, sub_id = row
            if committee not in links:
                counters['unmatchedCachedCommitteeRows'] += 1
                continue
            candidate = links[committee]
            reason = None
            amount = cents(amount)
            transaction_date = iso_date(raw_date)
            if not sub_id:
                raise ValueError('FEC record missing unique SUB_ID')
            if sub_id in seen:
                reason = 'duplicateSourceRecord'
            elif transaction_type not in ('15', '15E'):
                reason = 'otherTransactionType'
            elif entity != 'IND':
                reason = 'notConfirmedIndividual'
            elif amount is None:
                reason = 'invalidAmount'
            elif not transaction_date:
                reason = 'invalidDate'
            elif not f'{cycle - 1}-01-01' <= transaction_date <= min(f'{cycle}-12-31', today):
                reason = 'outOfPeriodOrFuture'
            if reason:
                exclusions[candidate][reason] += 1
                counters[reason] += 1
                continue
            seen.add(sub_id)
            add_amount(totals[candidate], amount)
            add_amount(employers[candidate][label(employer)], amount)
            add_amount(occupations[candidate][label(occupation)], amount)
            dates[candidate].add(transaction_date)
            counters['acceptedRows'] += 1
            if memo == 'X':
                counters['includedMemoRows'] += 1
            if amendment == 'A':
                counters['amendmentMarkedRows'] += 1
    result = {}
    for candidate in candidates:
        candidate_id = candidate['id']
        total = totals[candidate_id]
        groups = {}
        for field, categories in [('Employer', employers[candidate_id]), ('Occupation', occupations[candidate_id])]:
            ordered = sorted(categories.items(), key=lambda pair: (-pair[1]['amount'], pair[0]))
            known = [(name, values) for name, values in ordered if not missing(name)]
            top = known[:20]
            groups[field.lower() + 's'] = [dict(name=name, **dollars(values)) for name, values in top]
            groups['missing' + field + 'Amount'] = sum(values['amount'] for name, values in ordered if missing(name)) / 100
            groups['other' + field + 'Amount'] = sum(values['amount'] for _, values in known[20:]) / 100
            groups[field.lower() + 'GroupCount'] = len(known)
        result[candidate_id] = dict(status='available' if total['count'] else 'no-matched-records' if committee_sets[candidate_id] else 'no-committee-link',
                                   committees=sorted(committee_sets[candidate_id]), **dollars(total), **groups,
                                   dateFrom=min(dates[candidate_id], default=None), dateThrough=max(dates[candidate_id], default=None),
                                   exclusions=dict(exclusions[candidate_id]))
    return result, dict(counters)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cycles', nargs='+', type=int, default=[2024, 2026])
    parser.add_argument('--cache-dir', type=Path, default=ROOT / '.cache/affiliations')
    parser.add_argument('--force', action='store_true', help='Download a new snapshot instead of reusing the validated local cache')
    args = parser.parse_args()
    for selected_cycle in args.cycles:
        main(selected_cycle, args.cache_dir, args.force)
