#!/usr/bin/env python3
"""Import bounded upstream receipts and conservatively link IRS nonprofit records.

The threshold applies to individual receipt records, not a donor's cycle total.
No amount here is attributed to a candidate or described as dark money.
"""
import argparse
from collections import defaultdict
import csv
from datetime import datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import re
import ssl
import tempfile
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
API = 'https://api.open.fec.gov/v1/schedules/schedule_a/'
FORM5_API = 'https://api.open.fec.gov/v1/schedules/schedule_a_form5/'
IRS_INDEX = 'https://www.irs.gov/charities-non-profits/exempt-organizations-business-master-file-extract-eo-bmf'
IRS_DISCLOSURE = 'https://www.irs.gov/charities-non-profits/public-disclosure-and-availability-of-exempt-organizations-returns-and-applications-contributors-identities-not-subject-to-disclosure'
CONTEXT = ssl.create_default_context(cafile='/etc/ssl/cert.pem' if Path('/etc/ssl/cert.pem').exists() else None)
STATES = set('AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY PR'.split())
PUBLIC_CLIENT = None
CACHE_FRESH = False
CACHE_TTL = timedelta(hours=6)


def normalize(value):
    """Case/punctuation only: preserve INC, FUND, ACTION and every meaningful word."""
    return re.sub(r'[^a-z0-9]+', ' ', unicodedata.normalize('NFKD', value or '').casefold()).strip()


def zip5(value):
    value = str(value or '').strip()
    return value[:5] if re.match(r'^\d{5}', value) else None


def now():
    return datetime.now(timezone.utc).isoformat()


def money(value):
    try:
        amount = Decimal(str(value))
        if not amount.is_finite() or amount != amount.quantize(Decimal('0.01')):
            raise ValueError('Invalid FEC monetary precision')
        return amount
    except (InvalidOperation, ValueError) as error:
        raise ValueError('Invalid FEC monetary amount') from error


def cache_is_current(meta):
    try:
        age = datetime.now(timezone.utc) - datetime.fromisoformat(meta['fetchedAt'])
        return timedelta(0) <= age < CACHE_TTL
    except (KeyError, TypeError, ValueError):
        return False


def fetch(url, cache, api_key=None, offline=False):
    """Cache by public URL, never persist the key or authenticated URL."""
    cache.mkdir(parents=True, exist_ok=True)
    stem = hashlib.sha256(url.encode()).hexdigest()
    body_path, meta_path = cache / (stem + '.body'), cache / (stem + '.json')
    if body_path.exists() and meta_path.exists() and (offline or not CACHE_FRESH):
        body, meta = body_path.read_bytes(), json.loads(meta_path.read_text())
        if meta['url'] != url or meta['sha256'] != hashlib.sha256(body).hexdigest():
            raise ValueError('Cached source checksum or URL mismatch')
        if offline or cache_is_current(meta):
            return body, meta
    if offline:
        raise OSError('Source absent from offline cache')
    if PUBLIC_CLIENT is not None and url.startswith('https://api.open.fec.gov/v1/'):
        return PUBLIC_CLIENT.fetch(url, api=True)
    authenticated = url + ('&' if '?' in url else '?') + urllib.parse.urlencode({'api_key': api_key}) if api_key else url
    for attempt in range(3):
        try:
            req = urllib.request.Request(authenticated, headers={'User-Agent': 'WhoPaidWho/1.0 (public campaign-finance research)'})
            with urllib.request.urlopen(req, timeout=60, context=CONTEXT) as response:
                body = response.read()
                meta = {'url': url, 'fetchedAt': now(), 'sha256': hashlib.sha256(body).hexdigest(), 'lastModified': response.headers.get('Last-Modified')}
            body_path.write_bytes(body)
            meta_path.write_text(json.dumps(meta))
            return body, meta
        except urllib.error.HTTPError as error:
            if error.code in (401, 403, 429) or attempt == 2:
                raise RuntimeError(f'Source request failed with HTTP {error.code}; saved pages remain resumable') from None
        except (OSError, TimeoutError):
            if attempt == 2:
                raise RuntimeError('Source request failed; saved pages remain resumable') from None
        time.sleep(2 ** attempt)


def receipt_pages(cycle, threshold, cache, api_key, offline=False, max_pages=0, form5=False):
    # is_individual is a transaction-code flag, not entity identity: corporate
    # and nonprofit receipts can be true. Filter entity_type locally instead.
    amount_field = 'contribution_amount' if form5 else 'contribution_receipt_amount'
    endpoint = FORM5_API if form5 else API
    params = dict(two_year_transaction_period=cycle, min_amount=threshold, per_page=100, sort='-' + amount_field)
    records, sources, seen, cursors = [], [], set(), set()
    expected, exact, complete, issue = None, False, False, None
    while True:
        url = endpoint + '?' + urllib.parse.urlencode(params)
        try:
            body, source = fetch(url, cache, api_key, offline)
            data = json.loads(body)
            page, pagination = data['results'], data['pagination']
            if expected is None:
                expected, exact = pagination.get('count'), pagination.get('is_count_exact', False)
            elif exact and pagination.get('is_count_exact') and pagination.get('count') != expected:
                raise ValueError('FEC record count changed during import; use a new cache and retry')
            sources.append(source)
            for record in page:
                if record.get('two_year_transaction_period') != cycle:
                    raise ValueError('FEC returned a record from another cycle')
                if money(record.get(amount_field)) < money(threshold):
                    raise ValueError('FEC did not honor receipt threshold')
                sid = str(record.get('sub_id', ''))
                if not sid or sid in seen:
                    raise ValueError('Missing or duplicate Schedule A record ID; pagination cannot be trusted')
                seen.add(sid)
                records.append(record)
            if not page or (exact and len(records) == expected):
                complete = True
                break
            if exact and len(records) > expected:
                raise ValueError('Imported count exceeds FEC count')
            if max_pages and len(sources) >= max_pages:
                issue = 'Configured page limit reached'
                break
            cursor = pagination.get('last_indexes')
            cursor_key = json.dumps(cursor, sort_keys=True)
            if not cursor or cursor_key in cursors:
                raise ValueError('Missing or repeated FEC keyset cursor')
            cursors.add(cursor_key)
            params.update(cursor)
            if not offline:
                time.sleep(0.5)
        except (RuntimeError, OSError) as error:
            issue = str(error)
            break
    return records, sources, dict(status='complete-query' if complete else 'partial-query', minimumReceiptAmount=threshold,
        importedRecordCount=len(records), sourceRecordCount=expected, sourceCountExact=exact, pageCount=len(sources), issue=issue,
        description='Organization and committee receipts selected from all FEC receipt records at or above the stated threshold. Smaller receipts, refunds paid out, and original donors behind organizations are not covered. A partial query is not a complete list of qualifying receipts.')


def normalize_form5(record, filing):
    """The API omits filer_id; resolve the precise filing, never filer_name."""
    if (record.get('filing_form') != 'F5' or filing.get('form_type') != 'F5'
            or record.get('file_number') != filing.get('file_number')
            or str(record.get('link_id')) != str(filing.get('sub_id'))
            or not re.fullmatch(r'C\d{8}', filing.get('committee_id') or '')):
        raise ValueError('Form 5 filing identity did not match its receipt')
    image = str(record.get('image_number') or '')
    source_url = ('https://docquery.fec.gov/cgi-bin/fecimg/?' + image) if image.isdigit() else filing.get('html_url')
    if not source_url:
        raise ValueError('Form 5 receipt has no original record link')
    return record | dict(committee_id=filing['committee_id'], entity_type=record.get('contributor_type'),
        contribution_receipt_amount=record['contribution_amount'], sourceEndpoint='form5',
        pdf_url=source_url, line_number='F56', line_number_label='Form 5 — contributions received',
        recipientResolution=dict(method='exact-file-number-and-link-id', fileNumber=filing['file_number'],
            filingSubId=str(filing['sub_id']), committeeId=filing['committee_id'], sourceUrl=filing.get('html_url')))


def resolve_form5(records, cache, api_key, offline=False):
    resolved, sources, unresolved = [], [], []
    for record in records:
        if record.get('contributor_type') not in ('ORG', 'COM', 'PAC', 'PTY', 'CCM'):
            continue
        url = 'https://api.open.fec.gov/v1/filings/?' + urllib.parse.urlencode(dict(file_number=record.get('file_number'), per_page=100))
        try:
            body, source = fetch(url, cache, api_key, offline)
            data = json.loads(body)
            if data.get('pagination', {}).get('count') != 1 or len(data['results']) != 1:
                raise ValueError('Form 5 filing resolution was ambiguous')
            resolved.append(normalize_form5(record, data['results'][0]))
            sources.append(source)
        except (RuntimeError, OSError, ValueError) as error:
            unresolved.append(dict(subId=str(record['sub_id']), fileNumber=record.get('file_number'), issue=str(error)))
    return resolved, sources, unresolved


def receipt_kind(record):
    form, line = record.get('filing_form'), record.get('line_number')
    if form == 'F5':
        return 'contribution'
    if form == 'F3X':
        if line in ('11AI', '11B', '11C'): return 'contribution'
        if line == '12': return 'affiliated-transfer'
        if line == '13': return 'loan'
        if line == '14': return 'loan-repayment'
        if line in ('15', '16'): return 'refund-or-offset'
        if line == '17': return 'other-receipt'
    return 'other-receipt'


def eligible_receipt(record):
    # API is_individual=false is not a guarantee of organization identity.
    # Keep only affirmative entity codes and never publish individual addresses.
    return (record.get('entity_type') in ('ORG', 'COM', 'PAC', 'PTY', 'CCM')
            and (record.get('memoed_subtotal') is False or record.get('sourceEndpoint') == 'form5')
            and record.get('memo_code') != 'X'
            and bool(record.get('contributor_name'))
            and money(record.get('contribution_receipt_amount', 0)) > 0)


def irs_lookup(records, cache, offline=False):
    wanted = {normalize(r['contributor_name']) for r in records if r.get('entity_type') == 'ORG' and not r.get('contributor_id')}
    states = sorted({r.get('contributor_state') for r in records if r.get('entity_type') == 'ORG' and r.get('contributor_state') in STATES})
    lookup, sources, unavailable = defaultdict(list), [], []
    for state in states:
        url = f'https://www.irs.gov/pub/irs-soi/eo_{state.lower()}.csv'
        try:
            body, source = fetch(url, cache, offline=offline)
            reader = csv.DictReader(io.StringIO(body.decode('utf-8-sig')))
            if not {'EIN', 'NAME', 'CITY', 'STATE', 'ZIP', 'SUBSECTION'}.issubset(reader.fieldnames or []):
                raise ValueError('IRS BMF schema changed')
            sources.append(source)
            for row in reader:
                if normalize(row['NAME']) in wanted:
                    row['_sourceUrl'] = url
                    lookup[normalize(row['NAME'])].append(row)
        except (OSError, RuntimeError):
            unavailable.append(state)
    return lookup, sources, unavailable


def nonprofit_match(record, lookup):
    """Unique EIN, full normalized name, state and ZIP5; no fuzzy or alias joins."""
    if record.get('entity_type') != 'ORG' or record.get('contributor_id'):
        return None
    postal = zip5(record.get('contributor_zip'))
    if not postal or not record.get('contributor_state'):
        return None
    matches = {row['EIN']: row for row in lookup.get(normalize(record.get('contributor_name')), [])
               if row['STATE'] == record['contributor_state'] and zip5(row['ZIP']) == postal}
    if len(matches) != 1:
        return None
    row = next(iter(matches.values()))
    subsection = row['SUBSECTION'].zfill(2)
    if not re.fullmatch(r'\d{9}', row['EIN']) or not subsection.isdigit() or not (1 <= int(subsection) <= 29):
        return None
    return dict(ein=row['EIN'], name=row['NAME'], subsection=int(subsection), statusCode=row.get('STATUS'),
        matchMethod='unique-full-normalized-name-state-and-zip5', sourceUrl=row['_sourceUrl'])


def build_committees(spenders, records, lookup, coverage, cycle):
    committees = {cid: dict(status='no-qualifying-receipts' if coverage['status'] == 'complete-query' else 'unavailable',
                           name=name, sourceUrl=f'https://www.fec.gov/data/receipts/?committee_id={cid}&two_year_transaction_period={cycle}', donors=[])
                  for cid, name in sorted(spenders.items())}
    grouped = defaultdict(dict)
    for record in records:
        recipient = record.get('committee_id')
        if recipient not in committees or not eligible_receipt(record):
            continue
        nonprofit = nonprofit_match(record, lookup)
        donor_id = record.get('contributor_id')
        if not donor_id or not re.fullmatch(r'C\d{8}', donor_id):
            donor_id = 'EIN:' + nonprofit['ein'] if nonprofit else None
        kind = receipt_kind(record)
        # Without an identifier, retain location in the grouping key to avoid
        # conflating identical names. Do not expose street addresses in output.
        identity = donor_id or '|'.join(str(record.get(k) or '') for k in ('contributor_name', 'contributor_state', 'contributor_zip', 'contributor_street_1'))
        key = (identity, kind)
        if key not in grouped[recipient]:
            grouped[recipient][key] = dict(id=donor_id, name=record['contributor_name'], amount=Decimal(0),
                amountLabel='Selected large receipts', receiptCount=0, kind=kind,
                sourceUrl=(record['pdf_url'] if record.get('sourceEndpoint') == 'form5' else committees[recipient]['sourceUrl'] + '&' + urllib.parse.urlencode({'contributor_name': record['contributor_name'], 'min_amount': coverage['minimumReceiptAmount']})),
                disclosure='nonprofit-source' if nonprofit else ('fec-committee' if donor_id else 'organization-reported'),
                classificationProofURLs=[nonprofit['sourceUrl'], IRS_INDEX, IRS_DISCLOSURE] if nonprofit else ([f'https://www.fec.gov/data/committee/{donor_id}/?cycle={cycle}'] if donor_id else []),
                nonprofit=nonprofit, originalDonorVisibility='not-determined', records=[])
        donor = grouped[recipient][key]
        donor['amount'] += money(record['contribution_receipt_amount'])
        donor['receiptCount'] += 1
        donor['records'].append(dict(amount=record['contribution_receipt_amount'], date=record.get('contribution_receipt_date'),
            lineLabel=record.get('line_number_label') or kind, sourceUrl=record.get('pdf_url') or committees[recipient]['sourceUrl'],
            subId=str(record['sub_id']), form=record.get('filing_form'), lineNumber=record.get('line_number'),
            amendmentIndicator=record.get('amendment_indicator'), memoText=record.get('memo_text'),
            sourceEndpoint=record.get('sourceEndpoint', 'schedule-a'), recipientResolution=record.get('recipientResolution')))
    for cid, groups in grouped.items():
        donors = list(groups.values())
        for donor in donors:
            donor['amount'] = float(donor['amount'])
            donor['records'].sort(key=lambda r: (r['date'] or '', r['subId']), reverse=True)
        committees[cid]['donors'] = sorted(donors, key=lambda d: (-d['amount'], d['name'], d['kind']))
        committees[cid]['status'] = 'threshold-coverage' if coverage['status'] == 'complete-query' else 'partial-coverage'
    return committees


def validate_snapshot(data, spender_ids):
    """Reject inconsistent money/identity/coverage before any live file changes."""
    if set(data['committees']) != set(spender_ids):
        raise ValueError('Snapshot does not cover exactly the imported outside spenders')
    coverage = data['coverage']
    if coverage['status'] == 'complete-query':
        if (coverage['sourceCountExact'] and coverage['importedRecordCount'] != coverage['sourceRecordCount']
                or any(coverage[name]['status'] != 'complete-query' for name in ('scheduleA', 'form5'))
                or coverage['form5']['unresolvedOrganizationRows']):
            raise ValueError('Complete snapshot has incomplete source coverage')
    seen = set()
    for committee in data['committees'].values():
        for donor in committee['donors']:
            if (donor['receiptCount'] != len(donor['records'])
                    or money(donor['amount']) != sum((money(r['amount']) for r in donor['records']), Decimal(0))
                    or donor['originalDonorVisibility'] != 'not-determined'):
                raise ValueError('Donor receipt totals or visibility do not match source records')
            if donor['nonprofit'] and (not re.fullmatch(r'\d{9}', donor['nonprofit']['ein']) or not donor['classificationProofURLs']):
                raise ValueError('Nonprofit classification lacks identity evidence')
            for record in donor['records']:
                if money(record['amount']) < money(coverage['minimumReceiptAmount']) or record['subId'] in seen:
                    raise ValueError('Receipt is below threshold or duplicated')
                seen.add(record['subId'])


def publish_snapshots(pending):
    """Validate every cycle, stage complete adjacent files, then atomic replaces.

    Readers can see either complete version of an individual file. Replacing
    several paths is not a filesystem transaction, but validation/serialization
    failures cannot publish an earlier cycle before a later one fails.
    """
    prepared = []
    for target, data, spender_ids in pending:
        validate_snapshot(data, spender_ids)
        prepared.append((target, json.dumps(data, separators=(',', ':'), ensure_ascii=False, allow_nan=False) + '\n'))
    staged = []
    try:
        for target, contents in prepared:
            target.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=target.parent,
                                             prefix=target.name + '.', suffix='.tmp', delete=False) as handle:
                temporary = Path(handle.name)
                staged.append((temporary, target))
                handle.write(contents)
                handle.flush()
                os.fsync(handle.fileno())
        for temporary, target in staged:
            os.replace(temporary, target)
    finally:
        for temporary, _ in staged:
            temporary.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--cycles', type=int, nargs='+', default=[2024, 2026])
    parser.add_argument('--minimum-amount', type=int, default=1_000_000)
    parser.add_argument('--cache-dir', type=Path, default=ROOT / '.cache/funding-links')
    parser.add_argument('--offline', action='store_true')
    parser.add_argument('--fresh', action='store_true', help='Bypass the six-hour source cache and fetch current responses')
    parser.add_argument('--public-website', action='store_true', help='Use the FEC published public website data client configuration')
    parser.add_argument('--allow-partial', action='store_true', help='Write explicitly partial coverage instead of preserving the prior snapshot')
    parser.add_argument('--max-pages', type=int, default=0)
    args = parser.parse_args()
    if args.minimum_amount <= 0:
        parser.error('minimum amount must be positive')
    if args.fresh and args.offline:
        parser.error('--fresh and --offline cannot be combined')
    if len(args.cycles) != len(set(args.cycles)):
        parser.error('cycles must not contain duplicates')
    global PUBLIC_CLIENT, CACHE_FRESH
    CACHE_FRESH = args.fresh
    if args.public_website and not args.offline:
        spec = importlib.util.spec_from_file_location('outside_import', ROOT / 'scripts/refresh-outside.py')
        outside_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(outside_module)
        PUBLIC_CLIENT = outside_module.SourceClient(args.cache_dir, fresh=args.fresh, public_website=True)
    api_key = os.environ.get('FEC_API_KEY') or 'DEMO_KEY'
    pending = []
    for cycle in args.cycles:
        outside_path = ROOT / f'src/data/influence/outside-{cycle}.json'
        outside = json.loads(outside_path.read_text())
        spenders = {s['id']: s['name'] for c in outside['candidates'].values() for s in c.get('spenders', [])}
        records, sources, coverage = receipt_pages(cycle, args.minimum_amount, args.cache_dir, api_key, args.offline, args.max_pages)
        form5_records, form5_sources, form5_coverage = receipt_pages(cycle, args.minimum_amount, args.cache_dir, api_key, args.offline, args.max_pages, form5=True)
        resolved, resolution_sources, unresolved = resolve_form5(form5_records, args.cache_dir, api_key, args.offline)
        coverage['scheduleA'] = {key: coverage[key] for key in ('status', 'importedRecordCount', 'sourceRecordCount', 'pageCount')}
        coverage['form5'] = {key: form5_coverage[key] for key in ('status', 'importedRecordCount', 'sourceRecordCount', 'pageCount')}
        coverage['form5'].update(resolvedOrganizationRows=len(resolved), unresolvedOrganizationRows=unresolved)
        coverage['importedRecordCount'] += form5_coverage['importedRecordCount']
        coverage['sourceRecordCount'] = (coverage['sourceRecordCount'] + form5_coverage['sourceRecordCount']) if coverage['sourceRecordCount'] is not None and form5_coverage['sourceRecordCount'] is not None else None
        coverage['sourceCountExact'] = coverage['sourceCountExact'] and form5_coverage['sourceCountExact']
        coverage['pageCount'] += form5_coverage['pageCount']
        if form5_coverage['status'] != 'complete-query' or unresolved:
            coverage['status'] = 'partial-query'
            coverage['issue'] = form5_coverage['issue'] or 'Form 5 filer identity resolution incomplete'
        records.extend(resolved)
        sources.extend(form5_sources + resolution_sources)
        if coverage['status'] != 'complete-query' and not args.allow_partial:
            raise RuntimeError(f'{cycle}: incomplete receipt query; preserving prior snapshot. {coverage["issue"]}')
        relevant = [r for r in records if r.get('committee_id') in spenders and eligible_receipt(r)]
        lookup, irs_sources, unavailable = irs_lookup(relevant, args.cache_dir, args.offline)
        committees = build_committees(spenders, relevant, lookup, coverage, cycle)
        data = dict(schemaVersion=1, cycle=cycle, downloadedAt=max((s['fetchedAt'] for s in sources + irs_sources), default=now()), builtAt=now(), coverage=coverage, committees=committees,
            irsCoverage=dict(status='partial' if unavailable else 'queried-states-loaded', unavailableStates=unavailable,
                matching='Full normalized organization name, state and ZIP5; unique EIN only. Unmatched names remain unclassified. Current IRS registry status does not establish historical status at receipt date.'),
            sources=sources + irs_sources,
            limitations=['Amounts sum only imported, positive, nonmemo receipt records at or above the threshold; they are not complete donor totals or net contributions.',
                        'A receipt by an outside spender is not a donation to a candidate. No receipt is allocated to a particular expenditure or candidate.',
                        'IRS nonprofit identity does not show original donors, prove nondisclosure, or establish that money was dark money.',
                        'This importer uses FEC processed Schedule A records; it never sums amendment-inclusive raw OTHER or individual bulk files.'])
        target = ROOT / f'src/data/influence/funding-links-{cycle}.json'
        pending.append((target, data, set(spenders)))
    publish_snapshots(pending)
    for _, data, _ in pending:
        committees, coverage, cycle = data['committees'], data['coverage'], data['cycle']
        print(f'{cycle}: {coverage["importedRecordCount"]} source records, {sum(bool(c["donors"]) for c in committees.values())}/{len(committees)} spenders with links, {sum(d["disclosure"] == "nonprofit-source" for c in committees.values() for d in c["donors"])} nonprofit connections; {coverage["status"]}', flush=True)


if __name__ == '__main__':
    main()
