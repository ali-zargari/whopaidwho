#!/usr/bin/env python3
"""Build a uniform, source-linked FEC enforcement index for every imported candidate.

Uses public FEC HTML and official committee bulk files; no API key. The legal
index has names, not IDs. Match only unambiguous complete committee names, then
require the same name in the case's respondent table. Never infer guilt or total
penalties. Archived/secondary-respondent/name-change gaps remain explicit.
"""
import concurrent.futures
import argparse
import csv
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import re
import ssl
import tempfile
import time
import unicodedata
import urllib.request
from urllib.parse import urljoin
import zipfile
from collections import defaultdict

from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
BASE = 'https://www.fec.gov'
INDEX = BASE + '/data/legal/search/murs/'
CONTEXT = ssl.create_default_context(cafile='/etc/ssl/cert.pem' if Path('/etc/ssl/cert.pem').exists() else None)
CACHE = None


def fetch(url):
    cached = CACHE / (hashlib.sha256(url.encode()).hexdigest() + '.json') if CACHE else None
    if cached and cached.exists():
        data = json.loads(cached.read_text())
        body = bytes.fromhex(data['body'])
        if data['source']['url'] != url or data['source']['sha256'] != hashlib.sha256(body).hexdigest():
            raise ValueError('Invalid cached source')
        return body, data['source']
    for attempt in range(3):
        try:
            request = urllib.request.Request(url, headers={'User-Agent': 'WhoPaidWho/1.0 (public-record index; github.com/ali-zargari/whopaidwho)'})
            with urllib.request.urlopen(request, timeout=60, context=CONTEXT) as response:
                body = response.read()
            source = dict(url=url, sha256=hashlib.sha256(body).hexdigest(), fetchedAt=datetime.now(timezone.utc).isoformat())
            if cached:
                cached.write_text(json.dumps(dict(body=body.hex(), source=source)))
            return body, source
        except Exception:
            if attempt == 2:
                raise
            time.sleep(2 ** attempt)


def key(name):
    # Punctuation/case/spacing only. No token dropping, aliases, or fuzzy names.
    name = unicodedata.normalize('NFKD', name).casefold()
    return re.sub(r'[^a-z0-9]+', ' ', name).strip()


def zip_rows(body):
    with zipfile.ZipFile(io.BytesIO(body)) as archive:
        filename = next(n for n in archive.namelist() if n.lower().endswith('.txt'))
        yield from csv.reader(io.StringIO(archive.read(filename).decode('utf-8-sig', errors='replace')), delimiter='|')


def index_page(offset):
    url = f'{INDEX}?limit=100&offset={offset}&sort=-case_no'
    body, source = fetch(url)
    soup = BeautifulSoup(body, 'html.parser')
    info = soup.select_one('.results-info')
    match = re.search(r'Showing ([\d,]+)[–\-]([\d,]+) of ([\d,]+) results', info.get_text(' ', strip=True) if info else '')
    if not match:
        raise ValueError('FEC pagination schema changed')
    start, end, total = (int(n.replace(',', '')) for n in match.groups())
    if start != offset + 1:
        raise ValueError('FEC did not honor requested offset')
    entries = []
    for row in soup.select('.legal-search-result'):
        link = row.select_one('a[href*="matter-under-review/"]')
        if not link:
            raise ValueError('FEC index row missing case link')
        url = urljoin(BASE, link['href'])
        number = re.search(r'/matter-under-review/([^/]+)/', url).group(1)
        entries.append(dict(number=number, name=link.get_text(' ', strip=True), url=url))
    if len(entries) != end - start + 1:
        raise ValueError('FEC result count does not match rows')
    return entries, total, source


def table_rows(table):
    """Expand HTML rowspans, preserving the source's shared penalty groups."""
    active = {}
    for tr in table.select('tbody > tr'):
        cells = tr.find_all(['td', 'th'], recursive=False)
        expanded = []
        i = 0
        for col in range(len(table.select('thead th'))):
            if col in active:
                cell, remaining = active[col]
                expanded.append(cell)
                if remaining == 1:
                    del active[col]
                else:
                    active[col] = (cell, remaining - 1)
            else:
                if i >= len(cells):
                    raise ValueError('Unexpected FEC table shape')
                cell = cells[i]
                i += 1
                expanded.append(cell)
                span = int(cell.get('rowspan', 1))
                if span > 1:
                    active[col] = (cell, span - 1)
        if i != len(cells):
            raise ValueError('Unexpected extra FEC table cells')
        yield expanded


def case_detail(entry, proposed):
    body, source = fetch(entry['url'])
    soup = BeautifulSoup(body, 'html.parser')
    tables = {tuple(th.get_text(' ', strip=True) for th in table.select('thead th')): table for table in soup.select('table')}
    dispositions = tables.get(('Disposition', 'Penalty', 'Respondent', 'Citation'))
    participants = tables.get(('Relationship', 'Name'))
    # Older archived cases lack structured respondent tables: do not invent one.
    if dispositions is None or participants is None:
        return None, source, 'no-structured-respondents'
    respondent_names = {key(row[1].get_text(' ', strip=True)) for row in table_rows(participants) if 'respondent' in row[0].get_text(' ', strip=True).lower()}
    matches = [p for p in proposed if key(p['committeeName']) in respondent_names]
    if not matches:
        return None, source, 'respondent-name-not-confirmed'
    groups = {}
    for row in table_rows(dispositions):
        disposition, penalty, respondent, _ = row
        # Same DOM penalty cell may span several respondents. Keep that as ONE
        # shared amount with its whole respondent list, never multiply it.
        group_id = (id(disposition), id(penalty))
        group = groups.setdefault(group_id, dict(disposition=disposition.get_text(' ', strip=True), penalty=penalty.get_text(' ', strip=True) or None, respondents=[]))
        name = respondent.get_text(' ', strip=True)
        if name not in group['respondents']:
            group['respondents'].append(name)
    groups = list(groups.values())
    matches = [p for p in matches if any(key(p['committeeName']) in {key(n) for n in g['respondents']} for g in groups)]
    if not matches:
        return None, source, 'no-matched-disposition'
    for group in groups:
        group['matchedCandidateIds'] = sorted({p['candidateId'] for p in matches if key(p['committeeName']) in {key(n) for n in group['respondents']}})
    documents = []
    doc_table = tables.get(('Type', 'Date', 'Document'))
    if doc_table:
        for row in table_rows(doc_table):
            link = row[2].find('a', href=True)
            if link:
                raw_date = row[1].get_text(' ', strip=True)
                try:
                    date = datetime.strptime(raw_date, '%m/%d/%Y').date().isoformat()
                except ValueError:
                    date = None
                documents.append(dict(category=row[0].get_text(' ', strip=True), date=date, label=link.get_text(' ', strip=True), url=urljoin(BASE, link['href'])))
    latest = max((d['date'] for d in documents if d['date']), default=None)
    related = set()
    for match in re.finditer(r'\bin MURs\s+((?:\d{1,5}[\s,;]*(?:and\s+|&\s+)?){2,})[:.]', soup.get_text(' ', strip=True)):
        numbers = re.findall(r'\d+', match.group(1))
        if entry['number'] in numbers:
            related.update(numbers)
    return dict(**entry, matches=matches, dispositions=groups, documents=documents, relatedMatters=sorted(related,key=int), latestDocumentDate=latest, source=source), source, None


def main():
    started = datetime.now(timezone.utc).isoformat()
    snapshots = [json.loads(p.read_text()) for p in sorted((ROOT / 'src/data/fec').glob('[0-9][0-9][0-9][0-9].json'))]
    candidates = {c['id']: c for s in snapshots for c in s['candidates']}
    links = defaultdict(set)
    names = defaultdict(set)
    sources = []
    for snapshot in snapshots:
        cycle = snapshot['cycle']
        yy = str(cycle)[-2:]
        for c in snapshot['candidates']:
            if c.get('principalCommitteeId'):
                links[c['principalCommitteeId']].add(c['id'])
        for kind in ['cm', 'ccl']:
            body, source = fetch(f'{BASE}/files/bulk-downloads/{cycle}/{kind}{yy}.zip')
            sources.append(source)
            for row in zip_rows(body):
                if kind == 'cm':
                    if len(row) != 15:
                        raise ValueError('FEC committee master schema changed')
                    names[row[0]].add(row[1])
                    if row[8] in ['P', 'A'] and row[14] in candidates:
                        links[row[0]].add(row[14])
                else:
                    if len(row) != 7:
                        raise ValueError('FEC candidate linkage schema changed')
                    if row[0] in candidates and row[5] in ['P', 'A']:
                        links[row[3]].add(row[0])
    name_to_committees = defaultdict(set)
    for committee, variants in names.items():
        for name in variants:
            name_to_committees[key(name)].add(committee)
    lookup = defaultdict(list)
    ambiguous = 0
    for normalized, committees in name_to_committees.items():
        if len(committees) != 1:
            ambiguous += 1
            continue
        committee = next(iter(committees))
        if len(links[committee]) != 1:
            continue
        candidate = next(iter(links[committee]))
        for name in names[committee]:
            if key(name) == normalized:
                lookup[normalized].append(dict(candidateId=candidate, committeeId=committee, committeeName=name, method='unique-normalized-committee-name'))
                break
    print(f'Checking {len(candidates):,} candidate IDs against the same official index', flush=True)
    entries, total, source = index_page(0)
    sources.append(source)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for offset, result in zip(range(100, total, 100), pool.map(index_page, range(100, total, 100))):
            page_entries, page_total, page_source = result
            if page_total != total:
                raise ValueError('FEC corpus changed during pagination; retry refresh')
            entries.extend(page_entries)
            sources.append(page_source)
            if offset % 1000 == 0:
                print(f'Indexed {len(entries):,}/{total:,} cases', flush=True)
    if len(entries) != total or len({e['url'] for e in entries}) != total:
        diagnostics = ROOT / '.next/accountability-index-diagnostic.json'
        diagnostics.parent.mkdir(parents=True, exist_ok=True)
        diagnostics.write_text(json.dumps(entries))
        raise ValueError(f'Incomplete or duplicate case index. See {diagnostics}; preserving prior snapshot')
    # The source can list both current and archived versions of the same MUR.
    # Retain both in provenance, but select its current page once for display.
    unique_entries = {}
    for entry in sorted(entries, key=lambda e: 'mur_type=archived' in e['url']):
        unique_entries.setdefault(entry['number'], entry)
    proposals = [(entry, lookup[key(entry['name'])]) for entry in unique_entries.values() if key(entry['name']) in lookup]
    print(f'{total:,} case titles scanned; {len(proposals):,} unambiguous committee-name matches to verify', flush=True)
    cases, exclusions = [], []
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for (entry, _), (detail, source, reason) in zip(proposals, pool.map(lambda p: case_detail(*p), proposals)):
            sources.append(source)
            if detail:
                cases.append(detail)
            else:
                exclusions.append(dict(number=entry['number'], reason=reason))
    linked_candidates = {candidate for committee in links for candidate in links[committee] if names[committee]}
    matched_candidates = {m['candidateId'] for c in cases for m in c['matches']}
    snapshot = dict(schemaVersion=1, startedAt=started, downloadedAt=datetime.now(timezone.utc).isoformat(), source=INDEX, cycles=sorted(s['cycle'] for s in snapshots), candidatesChecked=len(candidates), candidatesWithCommitteeNames=len(linked_candidates), indexEntriesScanned=total, casesScanned=len(unique_entries), candidatesMatched=len(matched_candidates), ambiguousCommitteeNames=ambiguous, exclusions=exclusions, sources=sources, index=entries, cases=cases)
    snapshot['checkedCandidateIds'] = sorted(candidates)
    snapshot['candidateIdsWithCommitteeNames'] = sorted(linked_candidates)
    target = ROOT / 'src/data/accountability/fec-enforcement.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w', dir=target.parent, delete=False, encoding='utf-8') as temp:
        json.dump(snapshot, temp, ensure_ascii=False, separators=(',', ':'))
        temp_name = temp.name
    Path(temp_name).replace(target)
    print(f'Saved {len(cases):,} matched cases for {len(matched_candidates):,} candidates; all {len(candidates):,} checked. No matches are not clearance.', flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cache-dir', type=Path, help='Reuse downloaded sources for a resumed run. Omit for a fresh refresh; cached source dates remain recorded.')
    args = parser.parse_args()
    CACHE = args.cache_dir
    if CACHE:
        CACHE.mkdir(parents=True, exist_ok=True)
    main()
