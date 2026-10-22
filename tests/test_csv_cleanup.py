import json
import tempfile
import unittest
from pathlib import Path
from src.csv_cleanup import transform

ROOT = Path(__file__).resolve().parents[1]
SAMPLE = ROOT / 'experiments/001-demand-test/sample'


class CleanupTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.config = self.root / 'config.json'
        self.config.write_bytes((SAMPLE / 'config.json').read_bytes())
        self.source = self.root / 'input.csv'
        self.source.write_bytes((SAMPLE / 'synthetic-input.csv').read_bytes())

    def run_cleanup(self, output='out'):
        return transform(self.source, self.config, self.root / output)

    def test_sample_counts_original_and_ids(self):
        original = self.source.read_bytes()
        report = self.run_cleanup()
        self.assertEqual(report['counts'], dict(input_records=9, cleaned_records=3,
            quarantined_records=5, exact_duplicates_removed=1, field_trims=4))
        self.assertEqual(self.source.read_bytes(), original)
        self.assertEqual((self.root / 'out/original.csv').read_bytes(), original)
        self.assertTrue((self.root / 'out/cleaned.csv').read_text().splitlines()[1].startswith('0001,'))
        self.assertEqual(report['duplicates'], [{'record': 3, 'duplicate_of': 2}])

    def test_determinism_and_cleaned_idempotency(self):
        self.run_cleanup('first')
        self.run_cleanup('second')
        for name in ('original.csv', 'cleaned.csv', 'report.json'):
            self.assertEqual((self.root / 'first' / name).read_bytes(), (self.root / 'second' / name).read_bytes())
        transform(self.root / 'first/cleaned.csv', self.config, self.root / 'again')
        self.assertEqual((self.root / 'first/cleaned.csv').read_bytes(), (self.root / 'again/cleaned.csv').read_bytes())

    def test_existing_output_and_input_overwrite_refused(self):
        self.run_cleanup()
        with self.assertRaises(ValueError):
            self.run_cleanup()
        with self.assertRaises(ValueError):
            transform(self.source, self.config, self.source)

    def test_malformed_inputs_produce_no_directory(self):
        header = 'account_id,business_name,city,renewal_date\n'
        bad = ['', 'account_id,account_id\n', header + '1,too,few\n',
               header + '1,too,many,fields,here\n', header + '1,"open,x,y\n',
               header + '1,ba"re,x,y\n', header + '1,"ok"junk,x,y\n',
               header + '\n', header + '1,\x00,x,y\n']
        for content in bad:
            with self.subTest(content=content):
                self.source.write_text(content)
                with self.assertRaises((ValueError,)):
                    self.run_cleanup()
                self.assertFalse((self.root / 'out').exists())
        self.source.write_bytes(b'\xff')
        with self.assertRaises(UnicodeError):
            self.run_cleanup()

    def test_no_normalized_duplicate_deletion(self):
        self.source.write_text('account_id,business_name,city,renewal_date\n01, Name ,X,\n01,Name,X,\n')
        report = self.run_cleanup()
        self.assertEqual(report['counts']['exact_duplicates_removed'], 0)
        self.assertEqual(report['counts']['quarantined_records'], 2)

    def test_duplicate_rule_can_be_disabled(self):
        config = json.loads(self.config.read_text())
        config['remove_exact_full_row_duplicates'] = False
        self.config.write_text(json.dumps(config))
        report = self.run_cleanup()
        self.assertEqual(report['counts']['exact_duplicates_removed'], 0)
        self.assertEqual(report['counts']['quarantined_records'], 7)

    def test_formula_controls_dates_and_quoted_commas(self):
        self.source.write_text('account_id,business_name,city,renewal_date\n'
            '01,"Name, Inc",X,2026-02-28\n02, +1,X,\n03,@SUM(1),X,\n'
            '04,-1,X,\n05,"Tab\there",X,\n06,"New\nline",X,\n'
            '07,Good,X,2026-02-30\n,Missing key,X,\n')
        report = self.run_cleanup()
        self.assertEqual(report['counts']['cleaned_records'], 1)
        self.assertEqual(report['counts']['quarantined_records'], 7)

    def test_bom_crlf_escaped_quotes_and_trailing_control(self):
        self.source.write_bytes(('\ufeffaccount_id,business_name,city,renewal_date\r\n'
            '01,"Sample ""Quoted""",X,\r\n02,"Name\t",X,\r\n').encode('utf-8'))
        report = self.run_cleanup()
        self.assertEqual(report['counts']['cleaned_records'], 1)
        self.assertEqual(report['counts']['quarantined_records'], 1)
        self.assertEqual((self.root / 'out/original.csv').read_bytes(), self.source.read_bytes())

    def test_limits_headers_and_required_key(self):
        original = json.loads(self.config.read_text())
        for columns in [['=SUM(1)', 'business_name', 'city', 'renewal_date'],
                        ['account_id', 'bad\tname', 'city', 'renewal_date'],
                        ['account_id'] + ['field' + str(i) for i in range(20)]]:
            self.config.write_text(json.dumps(dict(original, columns=columns)))
            with self.assertRaises(ValueError):
                self.run_cleanup()
        self.config.write_text(json.dumps(dict(original, required=[])))
        with self.assertRaises(ValueError):
            self.run_cleanup()
        self.config.write_text(json.dumps(original))
        self.source.write_text('account_id,business_name,city,renewal_date\n' + '1,A,B,\n' * 10001)
        with self.assertRaises(ValueError):
            self.run_cleanup()
        self.source.write_bytes(b'a' * 5000001)
        with self.assertRaises(ValueError):
            self.run_cleanup()
        self.assertFalse((self.root / 'out').exists())

    def test_invalid_config(self):
        original = json.loads(self.config.read_text())
        for field, value in [('formula_policy', 'ignore'), ('trim', ['account_id']),
                             ('key', 'missing'), ('remove_exact_full_row_duplicates', 'yes'),
                             ('columns', ['a', 'a']), ('required', ['unknown'])]:
            with self.subTest(field=field):
                self.config.write_text(json.dumps(dict(original, **{field: value})))
                with self.assertRaises(ValueError):
                    self.run_cleanup()
                self.assertFalse((self.root / 'out').exists())


if __name__ == '__main__':
    unittest.main()
