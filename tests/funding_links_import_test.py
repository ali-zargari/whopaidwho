import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch, Mock
import json
from decimal import Decimal
from datetime import datetime, timedelta, timezone
import hashlib
import os
import tempfile

spec = importlib.util.spec_from_file_location('funding_links_import', Path(__file__).resolve().parents[1] / 'scripts/refresh-funding-links.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def receipt(**changes):
    row = dict(committee_id='C00000001', contributor_name='Example Civic Organization Inc', entity_type='ORG',
               contributor_state='VA', contributor_zip='220011234', contributor_street_1='1 Main Street',
               contributor_id=None, contribution_receipt_amount=1000000, contribution_receipt_date='2024-09-01',
               filing_form='F3X', line_number='17', line_number_label='Other Federal Receipts',
               memoed_subtotal=False, memo_code=None, sub_id='9000000000000000001', two_year_transaction_period=2024)
    return row | changes


def irs_row(**changes):
    return dict(EIN='123456789', NAME='EXAMPLE CIVIC ORGANIZATION INC', STATE='VA', ZIP='22001-0000',
                SUBSECTION='04', STATUS='01', _sourceUrl='https://www.irs.gov/pub/irs-soi/eo_va.csv') | changes


class FundingLinksImportTests(unittest.TestCase):
    def test_source_cache_expires_and_fresh_bypasses_it_without_faking_fetch_dates(self):
        url = module.API + '?cycle=2024'
        with tempfile.TemporaryDirectory() as directory:
            cache = Path(directory)
            stem = hashlib.sha256(url.encode()).hexdigest()
            raw = b'cached source'
            meta = dict(url=url, fetchedAt=datetime.now(timezone.utc).isoformat(), sha256=hashlib.sha256(raw).hexdigest())
            (cache / (stem + '.body')).write_bytes(raw)
            meta_path = cache / (stem + '.json')
            meta_path.write_text(json.dumps(meta))
            client = Mock()
            client.fetch.return_value = (b'new source', {'fetchedAt': 'new fetch timestamp'})
            with patch.object(module, 'PUBLIC_CLIENT', client), patch.object(module, 'CACHE_FRESH', False):
                self.assertEqual(module.fetch(url, cache), (raw, meta))
                client.fetch.assert_not_called()
                meta['fetchedAt'] = (datetime.now(timezone.utc) - timedelta(hours=7)).isoformat()
                meta_path.write_text(json.dumps(meta))
                self.assertEqual(module.fetch(url, cache), client.fetch.return_value)
                self.assertEqual(module.fetch(url, cache, offline=True), (raw, meta))
            meta['fetchedAt'] = datetime.now(timezone.utc).isoformat()
            meta_path.write_text(json.dumps(meta))
            client.reset_mock()
            with patch.object(module, 'PUBLIC_CLIENT', client), patch.object(module, 'CACHE_FRESH', True):
                self.assertEqual(module.fetch(url, cache), client.fetch.return_value)
                client.fetch.assert_called_once_with(url, api=True)

    def test_all_cycles_validate_before_publication_and_each_replace_has_complete_json(self):
        folder = Path(__file__).resolve().parents[1] / 'src/data/influence'
        snapshots = [json.loads((folder / f'funding-links-{year}.json').read_text()) for year in (2024, 2026)]
        with tempfile.TemporaryDirectory() as directory:
            targets = [Path(directory) / f'{year}.json' for year in (2024, 2026)]
            for target in targets:
                target.write_text('{"prior":true}')
            invalid = json.loads(json.dumps(snapshots[1]))
            invalid['coverage']['sourceRecordCount'] += 1
            with self.assertRaises(ValueError):
                module.publish_snapshots([(targets[0], snapshots[0], snapshots[0]['committees']),
                                          (targets[1], invalid, invalid['committees'])])
            self.assertTrue(all(json.loads(t.read_text()) == {'prior': True} for t in targets))
            original_replace = os.replace
            def verified_replace(source, target):
                self.assertEqual(source.parent, target.parent)
                self.assertNotEqual(source, target)
                self.assertTrue(json.loads(source.read_text())['committees'])
                self.assertTrue(json.loads(target.read_text()))
                original_replace(source, target)
            with patch.object(module.os, 'replace', side_effect=verified_replace) as replaced:
                module.publish_snapshots([(target, data, data['committees']) for target, data in zip(targets, snapshots)])
            self.assertEqual(replaced.call_count, 2)
            self.assertEqual([json.loads(t.read_text()) for t in targets], snapshots)
            self.assertFalse(list(Path(directory).glob('*.tmp')))

    def test_invalid_money_cannot_enter_a_snapshot(self):
        for value in (None, 'NaN', 'Infinity', '1.001'):
            with self.assertRaises(ValueError):
                module.money(value)

    def test_matching_requires_unique_name_state_and_zip(self):
        row = receipt()
        key = module.normalize(row['contributor_name'])
        self.assertEqual(module.nonprofit_match(row, {key: [irs_row()]})['ein'], '123456789')
        self.assertIsNone(module.nonprofit_match(row, {key: [irs_row(ZIP='22002')]}))
        self.assertIsNone(module.nonprofit_match(row, {key: [irs_row(STATE='DC')]}))
        self.assertIsNone(module.nonprofit_match(row, {key: [irs_row(), irs_row(EIN='987654321')]}))
        self.assertIsNone(module.nonprofit_match(receipt(contributor_zip=None), {key: [irs_row()]}))

    def test_meaningful_name_words_are_never_removed(self):
        self.assertNotEqual(module.normalize('Example Fund'), module.normalize('Example Fund Inc'))
        self.assertNotEqual(module.normalize('Example Action Fund'), module.normalize('Example Fund'))
        self.assertEqual(module.normalize('Example, Inc.'), module.normalize('EXAMPLE INC'))

    def test_form5_fields_resolve_through_exact_filing_ids_not_signatory_name(self):
        raw = dict(filing_form='F5', file_number=12, link_id=9000000000000000001,
                   contribution_amount=2000000, contributor_type='ORG', contributor_name='Organization',
                   filer_name='A SIGNATORY PERSON', image_number='202601010000000001', sub_id='receipt-5')
        filing = dict(form_type='F5', file_number=12, sub_id='9000000000000000001', committee_id='C90000001',
                      html_url='https://docquery.fec.gov/cgi-bin/forms/C90000001/12/')
        row = module.normalize_form5(raw, filing)
        self.assertEqual(row['committee_id'], 'C90000001')
        self.assertEqual(row['entity_type'], 'ORG')
        self.assertEqual(row['contribution_receipt_amount'], 2000000)
        self.assertTrue(module.eligible_receipt(row))
        self.assertEqual(module.receipt_kind(row), 'contribution')
        self.assertNotIn('memoed_subtotal', row)
        with self.assertRaises(ValueError):
            module.normalize_form5(raw, filing | {'file_number': 13})
        with self.assertRaises(ValueError):
            module.normalize_form5(raw, filing | {'sub_id': 'another-link'})

    def test_non_individual_filter_does_not_make_individuals_organizations(self):
        self.assertFalse(module.eligible_receipt(receipt(entity_type='IND', is_individual=False)))
        self.assertFalse(module.eligible_receipt(receipt(entity_type=None)))
        self.assertFalse(module.eligible_receipt(receipt(memoed_subtotal=True)))
        self.assertFalse(module.eligible_receipt(receipt(memo_code='X')))
        self.assertFalse(module.eligible_receipt(receipt(memoed_subtotal=None)))
        self.assertFalse(module.eligible_receipt(receipt(contribution_receipt_amount=-1000000)))

    def test_different_receipt_kinds_stay_separate_and_no_candidate_allocation(self):
        rows = [receipt(), receipt(sub_id='2', line_number='12'), receipt(sub_id='3', memoed_subtotal=True)]
        coverage = dict(status='complete-query', minimumReceiptAmount=1000000)
        entries = module.build_committees({'C00000001': 'Spender', 'C00000002': 'Other'}, rows, {}, coverage, 2024)
        self.assertEqual({d['kind'] for d in entries['C00000001']['donors']}, {'other-receipt', 'affiliated-transfer'})
        self.assertEqual(sum(d['amount'] for d in entries['C00000001']['donors']), 2000000)
        self.assertEqual(entries['C00000002']['status'], 'no-qualifying-receipts')
        self.assertTrue(all(d['originalDonorVisibility'] == 'not-determined' for d in entries['C00000001']['donors']))
        self.assertNotIn('candidateId', json.dumps(entries))

    def test_partial_empty_is_unavailable_not_zero(self):
        coverage = dict(status='partial-query', minimumReceiptAmount=1000000)
        entry = module.build_committees({'C00000001': 'Spender'}, [], {}, coverage, 2024)['C00000001']
        self.assertEqual(entry['status'], 'unavailable')

    def test_keyset_cursor_is_forwarded_and_duplicate_ids_fail(self):
        first = dict(results=[receipt()], pagination=dict(count=2, is_count_exact=True,
                     last_indexes=dict(last_index='cursor-1', last_contribution_receipt_amount='1000000')))
        second = dict(results=[receipt(sub_id='2')], pagination=dict(count=2, is_count_exact=True, last_indexes={}))
        urls = []
        def fake_fetch(url, *args):
            urls.append(url)
            return json.dumps(first if len(urls) == 1 else second).encode(), dict(url=url)
        with patch.object(module, 'fetch', side_effect=fake_fetch):
            records, sources, coverage = module.receipt_pages(2024, 1000000, Path('/tmp/not-used'), 'unused')
        self.assertEqual(coverage['status'], 'complete-query')
        self.assertEqual(len(records), 2)
        self.assertIn('last_index=cursor-1', urls[1])
        self.assertNotIn('is_individual', urls[0])
        second['results'] = [receipt()]
        urls.clear()
        with patch.object(module, 'fetch', side_effect=fake_fetch), self.assertRaises(ValueError):
            module.receipt_pages(2024, 1000000, Path('/tmp/not-used'), 'unused')

    def test_snapshots_reconcile_receipts_and_cover_every_outside_spender(self):
        for cycle in (2024, 2026):
            folder = Path(__file__).resolve().parents[1] / 'src/data/influence'
            snapshot = json.loads((folder / f'funding-links-{cycle}.json').read_text())
            outside = json.loads((folder / f'outside-{cycle}.json').read_text())
            expected = {s['id'] for c in outside['candidates'].values() for s in c.get('spenders', [])}
            module.validate_snapshot(snapshot, expected)
            self.assertEqual(set(snapshot['committees']), expected)
            self.assertEqual(snapshot['coverage']['status'], 'complete-query')
            self.assertEqual(snapshot['coverage']['importedRecordCount'], snapshot['coverage']['sourceRecordCount'])
            self.assertEqual(snapshot['coverage']['form5']['status'], 'complete-query')
            self.assertEqual(snapshot['coverage']['form5']['unresolvedOrganizationRows'], [])
            ids = set()
            for committee in snapshot['committees'].values():
                for donor in committee['donors']:
                    self.assertEqual(Decimal(str(donor['amount'])), sum((Decimal(str(r['amount'])) for r in donor['records']), Decimal(0)))
                    self.assertEqual(donor['receiptCount'], len(donor['records']))
                    self.assertEqual(donor['originalDonorVisibility'], 'not-determined')
                    if donor['nonprofit']:
                        self.assertEqual(len(donor['nonprofit']['ein']), 9)
                        self.assertTrue(donor['classificationProofURLs'])
                    for record in donor['records']:
                        self.assertGreaterEqual(record['amount'], snapshot['coverage']['minimumReceiptAmount'])
                        self.assertNotIn(record['subId'], ids)
                        ids.add(record['subId'])


if __name__ == '__main__':
    unittest.main()
