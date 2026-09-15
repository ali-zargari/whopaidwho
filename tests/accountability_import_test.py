import importlib.util
from pathlib import Path
import unittest
from bs4 import BeautifulSoup

spec = importlib.util.spec_from_file_location('accountability_import', Path(__file__).resolve().parents[1] / 'scripts/refresh-accountability.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class ImportTests(unittest.TestCase):
    def test_shared_penalty_cell_is_preserved_across_respondents(self):
        soup = BeautifulSoup('''<table><thead><tr><th>Disposition</th><th>Penalty</th><th>Respondent</th><th>Citation</th></tr></thead><tbody>
        <tr><td rowspan="3">Conciliation</td><td rowspan="2">$42,000</td><td>Campaign</td><td>Statute</td></tr>
        <tr><td>Treasurer</td><td>Statute</td></tr>
        <tr><td>$7,500</td><td>Other respondent</td><td>Other statute</td></tr>
        </tbody></table>''', 'html.parser')
        rows = list(module.table_rows(soup.table))
        self.assertEqual(len(rows), 3)
        self.assertIs(rows[0][0], rows[2][0])
        self.assertIs(rows[0][1], rows[1][1])
        self.assertIsNot(rows[0][1], rows[2][1])
        self.assertEqual(rows[2][2].get_text(), 'Other respondent')

    def test_bad_table_schema_fails_instead_of_shifting_respondents(self):
        soup = BeautifulSoup('<table><thead><tr><th>A</th><th>B</th></tr></thead><tbody><tr><td>Only one cell</td></tr></tbody></table>', 'html.parser')
        with self.assertRaises(ValueError):
            list(module.table_rows(soup.table))

    def test_name_matching_does_not_drop_meaningful_words(self):
        self.assertEqual(module.key('FRIENDS OF JANE, INC.'), module.key('Friends of Jane Inc'))
        self.assertNotEqual(module.key('Jane for Senate'), module.key('Jane for Congress'))
        self.assertNotEqual(module.key('Friends of Jane'), module.key('Jane'))

if __name__ == '__main__':
    unittest.main()
