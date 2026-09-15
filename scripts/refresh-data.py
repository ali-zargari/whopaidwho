#!/usr/bin/env python3
"""Refresh reproducible FEC snapshots. Python 3 standard library; no API key.

Schema: https://www.fec.gov/campaign-finance-data/all-candidates-file-description/
Files are validated in memory, then atomically replaced. Failure leaves prior data intact.
"""
import argparse
import csv
import hashlib
import io
import json
from pathlib import Path
import urllib.request
import zipfile
import ssl
from collections import defaultdict
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]

def download(url):
    request = urllib.request.Request(url, headers={"User-Agent": "WhoPaidWho/1.0 (public FEC data explorer)"})
    context = ssl.create_default_context(cafile='/etc/ssl/cert.pem' if Path('/etc/ssl/cert.pem').exists() else None)
    with urllib.request.urlopen(request, timeout=90, context=context) as response:
        data = response.read()
    return data

def rows(data):
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        name = next(n for n in archive.namelist() if n.endswith('.txt'))
        with archive.open(name) as file:
            yield from csv.reader(io.TextIOWrapper(file, encoding='utf-8-sig', errors='replace'), delimiter='|')

def display_name(raw):
    parts = raw.split(',', 1)
    name = (parts[1].strip() + ' ' + parts[0].strip()) if len(parts) == 2 else raw
    return name.title()

def refresh(cycle):
    url = f'https://www.fec.gov/files/bulk-downloads/{cycle}/weball{str(cycle)[-2:]}.zip'
    archive = download(url)
    candidate_source = f'https://www.fec.gov/files/bulk-downloads/{cycle}/cn{str(cycle)[-2:]}.zip'
    candidate_archive = download(candidate_source)
    registrations = {r[0]: r for r in rows(candidate_archive)}
    candidates = []
    for row in rows(archive):
        if not row or row[0][:1] not in ('H', 'S'):
            continue
        if len(row) != 30:
            raise ValueError(f'Unexpected FEC schema: {len(row)} columns')
        money = lambda index: round(float(row[index] or 0), 2)
        candidates.append(dict(
            id=row[0], name=display_name(row[1]), filedName=row[1], status=row[2],
            party=row[4], office='senate' if row[0][0] == 'S' else 'house',
            state=row[18], district=row[19], cycle=cycle,
            receipts=money(5), transfersIn=money(6), disbursements=money(7), transfersOut=money(8),
            cash=money(10), selfContributions=money(11), candidateLoans=money(12), otherLoans=money(13),
            debt=money(16), individuals=money(17), committees=money(25), partyContributions=money(26),
            coverageEnd=datetime.strptime(row[27], '%m/%d/%Y').date().isoformat() if row[27] else None,
            individualRefunds=money(28), committeeRefunds=money(29),
        ))
    if len(candidates) < 500 or len({c['id'] for c in candidates}) != len(candidates):
        raise ValueError('Incomplete or duplicate candidate data; refusing to replace snapshot')
    for candidate in candidates:
        registration = registrations.get(candidate['id'])
        candidate['electionYear'] = int(registration[3]) if registration and registration[3].isdigit() else None
        candidate['registrationStatus'] = registration[8] if registration else None
        candidate['principalCommitteeId'] = registration[9] if registration else None
    # Itemization is supplementary: use it only when the periods and totals agree.
    summary_url = f'https://www.fec.gov/files/bulk-downloads/{cycle}/candidate_summary_{cycle}.csv'
    summary_data = download(summary_url)
    summaries = {r['Cand_Id']: r for r in csv.DictReader(io.StringIO(summary_data.decode('utf-8-sig')))}
    for candidate in candidates:
        candidate['itemized'] = None
        candidate['unitemized'] = None
        summary = summaries.get(candidate['id'])
        if not summary:
            continue
        coverage = (summary.get('Coverage_End_Date') or '')[:10]
        # CSV dates are DD-MON-YY, unlike weball dates.
        try:
            coverage = datetime.strptime(coverage, '%d-%b-%y').date().isoformat()
        except ValueError:
            try:
                coverage = datetime.strptime(coverage, '%m/%d/%Y').date().isoformat()
            except ValueError:
                pass
        if coverage != candidate['coverageEnd'] or abs(float(summary['Individual_Contribution'] or 0) - candidate['individuals']) > 0.02:
            continue
        itemized = float(summary['Individual_Itemized_Contribution'] or 0)
        unitemized = float(summary['Individual_Unitemized_Contribution'] or 0)
        if abs(itemized + unitemized - candidate['individuals']) < 0.02:
            candidate['itemized'], candidate['unitemized'] = itemized, unitemized
    candidates.sort(key=lambda c: (-c['receipts'], c['id']))
    registered_candidates = [dict(id=r[0],name=display_name(r[1]),party=r[2],electionYear=int(r[3]),state=r[4],office='senate' if r[5]=='S' else 'house',district=r[6],status=r[8]) for r in registrations.values() if r[5] in ('H','S') and r[3] == str(cycle) and r[8] == 'C']
    result = dict(cycle=cycle, registrations=registered_candidates, downloadedAt=datetime.now(timezone.utc).isoformat(),
                  source=url, candidateSource=candidate_source, candidateSha256=hashlib.sha256(candidate_archive).hexdigest(), summarySource=summary_url, summarySha256=hashlib.sha256(summary_data).hexdigest(), sha256=hashlib.sha256(archive).hexdigest(), candidates=candidates)
    target = ROOT / 'src' / 'data' / 'fec' / f'{cycle}.json'
    print(f'{cycle}: {len(candidates):,} congressional candidates validated')
    return [(target, result), refresh_records(cycle)]

def refresh_records(cycle):
    yy = str(cycle)[-2:]
    source = f'https://www.fec.gov/files/bulk-downloads/{cycle}/pas2{yy}.zip'
    committee_source = f'https://www.fec.gov/files/bulk-downloads/{cycle}/cm{yy}.zip'
    archive, committee_archive = download(source), download(committee_source)
    committees = {r[0]: r for r in rows(committee_archive)}
    grouped = defaultdict(list)
    outside_grouped = defaultdict(list)
    seen = set()
    for row in rows(archive):
        if len(row) != 22:
            raise ValueError(f'Unexpected committee schema: {len(row)} columns')
        if row[5] in ('24A', '24E'):
            payload = tuple(row[:21])
            if payload in seen:
                continue
            seen.add(payload)
            try:
                reported_date = datetime.strptime(row[13], '%m%d%Y').date().isoformat()
            except ValueError:
                continue
            if not (f'{cycle-1}-01-01' <= reported_date <= f'{cycle}-12-31'):
                continue
            spender = committees.get(row[0])
            outside_grouped[row[16]].append(dict(id=row[21], committeeId=row[0], name=spender[1] if spender else row[0],
                amount=float(row[14] or 0), date=reported_date, stance='support' if row[5]=='24E' else 'oppose',
                committeeType=spender[9] if spender else None, type=row[5], memo=row[20] or None,
                isMemo=row[19]=='X', amendment=row[1], fileNumber=row[18]))
            continue
        if row[5] not in ('24K', '24Z'):
            continue
        recipient = committees.get(row[15])
        if not recipient or recipient[8] not in ('P','A') or recipient[14] != row[16]:
            continue
        payload = tuple(row[:21])
        if payload in seen:
            continue
        seen.add(payload)
        try:
            reported_date = datetime.strptime(row[13], '%m%d%Y').date().isoformat()
        except ValueError:
            continue
        # The cycle file can contain adjustments for earlier activity. Restrict
        # the displayed date to this period so every row honors the cycle filter.
        if not (f'{cycle-1}-01-01' <= reported_date <= f'{cycle}-12-31'):
            continue
        donor = committees.get(row[0])
        grouped[row[16]].append(dict(id=row[21], committeeId=row[0], name=donor[1] if donor else row[0],
            recipientId=row[15], connectedOrganization=donor[13] if donor else None, organizationType=donor[12] if donor else None, amount=float(row[14] or 0), date=reported_date,
            type=row[5], memo=row[20] or None, isMemo=row[19] == 'X', amendment=row[1], fileNumber=row[18]))
    result = {}
    for candidate_id in set(grouped) | set(outside_grouped):
        entries = grouped[candidate_id]
        entries.sort(key=lambda r: (r['date'], int(r['fileNumber'] or 0), r['id']), reverse=True)
        selected, used = [], set()
        for entry in entries:
            if entry['committeeId'] not in used:
                selected.append(entry)
                used.add(entry['committeeId'])
            if len(selected) == 12:
                break
        corporate, corporate_used = [], set()
        for entry in entries:
            if entry['organizationType'] == 'C' and entry['connectedOrganization'] and entry['committeeId'] not in corporate_used:
                corporate.append(entry)
                corporate_used.add(entry['committeeId'])
            if len(corporate) == 8:
                break
        outside_records, outside_used = [], set()
        for entry in sorted(outside_grouped[candidate_id], key=lambda r:(r['date'], int(r['fileNumber'] or 0), r['id']), reverse=True):
            key = (entry['committeeId'],entry['stance'])
            if key not in outside_used:
                outside_records.append(entry)
                outside_used.add(key)
            if len(outside_records) == 8:
                break
        result[candidate_id] = dict(outsideRecords=outside_records, records=selected, corporateRecords=corporate, committeeCount=len({r['committeeId'] for r in entries}))
    output = dict(cycle=cycle, downloadedAt=datetime.now(timezone.utc).isoformat(), source=source,
        committeeSource=committee_source, sha256=hashlib.sha256(archive).hexdigest(),
        committeeSha256=hashlib.sha256(committee_archive).hexdigest(), candidates=result)
    target = ROOT / 'src' / 'data' / 'fec' / f'committee-records-{cycle}.json'
    if len(result) < 100:
        raise ValueError('Incomplete committee records; refusing replacement')
    print(f'{cycle}: source-linked committee records for {len(result):,} candidates validated')
    return target, output

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--cycles', nargs='+', type=int, default=[((datetime.now(timezone.utc).year + 1) // 2) * 2 - 2, ((datetime.now(timezone.utc).year + 1) // 2) * 2])
    args = parser.parse_args()
    pending = []
    for cycle in args.cycles:
        if cycle < 2000 or cycle % 2:
            parser.error('Cycles must be even years from 2000 onward')
        pending.extend(refresh(cycle))
    # Download and validate all sources before touching the active snapshots.
    for target, payload in pending:
        temporary = target.with_suffix('.tmp')
        temporary.write_text(json.dumps(payload, separators=(',', ':'), ensure_ascii=False) + '\n')
        temporary.replace(target)
    data_dir = ROOT / 'src' / 'data' / 'fec'
    cycles = sorted(int(p.stem) for p in data_dir.glob('*.json') if p.stem.isdigit())
    imports = '\n'.join(f'import data{c} from "./{c}.json";' for c in cycles)
    entries = ','.join(f'{c}:data{c}' for c in cycles)
    catalog = '/* Generated by scripts/refresh-data.py. */\nimport type { Snapshot } from "@/lib/types";\n' + imports + '\nexport const datasets: Record<number,Snapshot> = {' + entries + '};\n'
    (data_dir / 'catalog.ts').write_text(catalog)
    print('Snapshots and cycle catalog saved. Rebuild/restart the app to publish them.')
