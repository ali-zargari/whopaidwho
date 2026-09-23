import gzip
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('affiliations_import', ROOT / 'scripts/refresh-affiliations.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def row(sub_id='1', amount='100', employer='Acme, Inc.', occupation='Engineer', **changes):
    fields = dict(committee='C00000001', amendment='N', report_type='Q1', image='202504159000000001',
                  transaction_type='15', entity='IND', employer=employer, occupation=occupation,
                  date='02012025', amount=amount, other='', transaction='A1', file_number='1',
                  memo='', memo_text='', sub_id=sub_id)
    fields.update(changes)
    return list(fields.values())


class AffiliationImportTests(unittest.TestCase):
    def test_external_candidate_ids_still_make_committee_links_ambiguous(self):
        cm = ['C00000001', 'Campaign', '', '', '', '', '', '', 'P', 'S', '', '', '', '', 'S00000001']
        ccl = ['P00000001', '2024', '2024', 'C00000001', 'P', 'P', '1']
        def fake_source(cycle, kind):
            return ([cm] if kind == 'cm' else [ccl]), {'url': kind}
        with patch.object(module, 'small_zip', side_effect=fake_source):
            links, _, ambiguous = module.committee_links(2024, [{'id': 'S00000001', 'principalCommitteeId': 'C00000001'}])
        self.assertEqual(links, {})
        self.assertEqual(ambiguous, ['C00000001'])

    def aggregate(self, rows):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'records.gz'
            with gzip.open(path, 'wt') as output:
                for record in rows:
                    output.write(json.dumps(record) + '\n')
            return module.aggregate(path, 2026, [{'id': 'H00000001'}, {'id': 'H00000002'}],
                                    module.defaultdict(list, {'H00000001': ['C00000001']}),
                                    {'C00000001': 'H00000001'})

    def test_signed_amounts_and_duplicate_record_ids(self):
        result, diagnostics = self.aggregate([row(), row(), row('2', '-25')])
        record = result['H00000001']
        self.assertEqual((record['amount'], record['positiveAmount'], record['negativeAmount'], record['count']),
                         (75, 100, -25, 2))
        self.assertEqual(record['employers'][0]['name'], 'ACME, INC.')
        self.assertEqual(diagnostics['duplicateSourceRecord'], 1)
        self.assertEqual(result['H00000002']['status'], 'no-committee-link')

    def test_conduits_organizations_self_funding_and_refunds_are_separate(self):
        records = [row(str(i), transaction_type=kind) for i, kind in enumerate(['15C', '15I', '15T', '24T', '22Y'])]
        records.extend([row('org', entity='ORG'), row('unknown', entity=''),
                        row('earmark', transaction_type='15E', other='C00401224', memo='X')])
        result, diagnostics = self.aggregate(records)
        self.assertEqual(result['H00000001']['amount'], 100)
        self.assertEqual(result['H00000001']['count'], 1)
        self.assertEqual(diagnostics['includedMemoRows'], 1)
        self.assertEqual(diagnostics['otherTransactionType'], 5)
        self.assertEqual(diagnostics['notConfirmedIndividual'], 2)

    def test_missing_information_and_remainders_reconcile(self):
        records = [row(str(i), str(i + 1), employer=f'Employer {i}', occupation='Job') for i in range(25)]
        records.extend([row('missing', '42', employer=' INFORMATION   REQUESTED ', occupation='')])
        result, _ = self.aggregate(records)
        record = result['H00000001']
        self.assertEqual(len(record['employers']), 20)
        self.assertEqual(record['missingEmployerAmount'], 42)
        self.assertEqual(record['missingOccupationAmount'], 42)
        self.assertEqual(record['amount'], sum(r['amount'] for r in record['employers']) + record['otherEmployerAmount'] + record['missingEmployerAmount'])
        self.assertEqual(record['amount'], sum(r['amount'] for r in record['occupations']) + record['otherOccupationAmount'] + record['missingOccupationAmount'])

    def test_invalid_and_outside_period_dates_are_not_silently_counted(self):
        result, diagnostics = self.aggregate([row('invalid', date='99999999'), row('old', date='01012024'),
                                             row('future', date='01012030'), row('nan', amount='NaN')])
        self.assertEqual(result['H00000001']['status'], 'no-matched-records')
        self.assertEqual(diagnostics['invalidDate'], 1)
        self.assertEqual(diagnostics['outOfPeriodOrFuture'], 2)
        self.assertEqual(diagnostics['invalidAmount'], 1)

    def test_cached_committee_no_longer_eligible_is_not_assigned(self):
        with tempfile.TemporaryDirectory() as temp:
            path = Path(temp) / 'records.gz'
            with gzip.open(path, 'wt') as output:
                output.write(json.dumps(row()) + '\n')
            result, diagnostic = module.aggregate(path, 2026, [{'id': 'H00000001'}], module.defaultdict(list), {})
        self.assertEqual(result['H00000001']['status'], 'no-committee-link')
        self.assertEqual(diagnostic['unmatchedCachedCommitteeRows'], 1)

    def test_stream_only_reads_main_member_and_checks_crc(self):
        output = io.BytesIO()
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('itcont.txt', b'one\ntwo\n')
            archive.writestr('by_date/duplicate.txt', b'one\ntwo\n')
        body = output.getvalue()
        class Response(io.BytesIO):
            headers = {'Content-Length': str(len(body)), 'Last-Modified': 'test', 'ETag': 'test'}
        captured = []
        with patch.object(module, 'open_url', return_value=Response(body)):
            source = module.stream_archive('https://example.test/fixture.zip', captured.append)
        self.assertEqual(captured, [b'one', b'two'])
        self.assertEqual(source['rows'], 2)
        self.assertEqual(source['compressedBytes'], len(body))


if __name__ == '__main__':
    unittest.main()
