"""Conservative, offline CSV demonstration. Python standard library only."""
import argparse
import csv
import hashlib
import io
import json
import re
from pathlib import Path


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def validate_csv_quotes(text):
    """Reject quotes inside unquoted fields and junk after closing quotes."""
    state = 'start'
    for char in text:
        if state == 'quoted':
            if char == '"':
                state = 'closed'
        elif state == 'closed':
            if char == '"':
                state = 'quoted'
            elif char == ',':
                state = 'start'
            elif char in '\r\n':
                state = 'start'
            else:
                raise ValueError('Unexpected character after closing quote')
        elif char == '"':
            if state != 'start':
                raise ValueError('Quote inside unquoted field')
            state = 'quoted'
        elif char in ',\r\n':
            state = 'start'
        else:
            state = 'plain'
    if state == 'quoted':
        raise ValueError('Unterminated quoted field')


def transform(input_path, config_path, output_path):
    source, config_file, output = map(Path, (input_path, config_path, output_path))
    if output.exists():
        raise ValueError('Output directory already exists; refusing overwrite')
    if source.stat().st_size > 5_000_000 or config_file.stat().st_size > 100_000:
        raise ValueError('Input or configuration exceeds demonstration byte limit')
    raw = source.read_bytes()
    config_raw = config_file.read_bytes()
    config = json.loads(config_raw)
    expected = {'columns', 'key', 'required', 'trim', 'ambiguous_date_fields',
                'remove_exact_full_row_duplicates', 'formula_policy'}
    if not isinstance(config, dict) or set(config) != expected:
        raise ValueError('Unexpected or missing configuration keys')
    columns = config['columns']
    if (not isinstance(columns, list) or not columns or
            not all(isinstance(c, str) and c and c == c.strip() for c in columns) or
            len(set(columns)) != len(columns) or len(columns) > 20 or
            any(c.lstrip().startswith(('=', '+', '-', '@')) or
                any(ord(ch) < 32 or ch == '\ufeff' for ch in c) for c in columns)):
        raise ValueError('Invalid configured columns')
    if not isinstance(config['key'], str) or config['key'] not in columns:
        raise ValueError('Unknown key column')
    for field in ('required', 'trim', 'ambiguous_date_fields'):
        if (not isinstance(config[field], list) or
                not all(c in columns for c in config[field]) or
                len(set(config[field])) != len(config[field])):
            raise ValueError('Invalid column rule: ' + field)
    if config['key'] not in config['required']:
        raise ValueError('Key must be required')
    if config['key'] in config['trim']:
        raise ValueError('Key trimming is prohibited to preserve identifiers')
    if type(config['remove_exact_full_row_duplicates']) is not bool:
        raise ValueError('Duplicate policy must be explicit boolean')
    if config['formula_policy'] != 'quarantine':
        raise ValueError('Only quarantine formula policy is supported')
    text = raw.decode('utf-8-sig')
    if '\x00' in text:
        raise ValueError('NUL bytes are not supported')
    validate_csv_quotes(text)
    rows = list(csv.reader(io.StringIO(text, newline=''), strict=True))
    if len(rows) - 1 > 10_000:
        raise ValueError('More than 10000 data rows')
    if not rows or rows[0] != columns:
        raise ValueError('Header must match configured columns exactly')
    if any(len(row) != len(columns) for row in rows[1:]):
        raise ValueError('Malformed row width; no output written')
    records, duplicates, changes, seen = [], [], [], {}
    for number, row in enumerate(rows[1:], 2):
        original = tuple(row)
        if original in seen and config['remove_exact_full_row_duplicates']:
            duplicates.append({'record': number, 'duplicate_of': seen[original]})
            continue
        seen.setdefault(original, number)
        values = dict(zip(columns, row))
        for field in config['trim']:
            before = values[field]
            values[field] = before.strip()
            if before != values[field]:
                changes.append({'record': number, 'field': field, 'before': before,
                                'after': values[field], 'rule': 'trim_outer_whitespace'})
        records.append((number, values, dict(zip(columns, original))))
    key_counts = {}
    for _, values, _ in records:
        key = values[config['key']]
        if key:
            key_counts[key] = key_counts.get(key, 0) + 1
    cleaned, exceptions = [], []
    for number, values, original_values in records:
        reasons = []
        for field in config['required']:
            if not values[field].strip():
                reasons.append('missing_required:' + field)
        if key_counts.get(values[config['key']], 0) > 1:
            reasons.append('repeated_key_requires_resolution:' + config['key'])
        for field in config['ambiguous_date_fields']:
            if values[field] and not re.fullmatch(r'\d{4}-\d{2}-\d{2}', values[field]):
                reasons.append('non_iso_date_requires_resolution:' + field)
            elif values[field]:
                from datetime import date
                try:
                    date.fromisoformat(values[field])
                except ValueError:
                    reasons.append('invalid_date:' + field)
        for field, value in original_values.items():
            if value.lstrip().startswith(('=', '+', '-', '@')) or any(ord(c) < 32 or c == '\ufeff' for c in value):
                reasons.append('spreadsheet_formula_or_control_risk:' + field)
        if reasons:
            exceptions.append({'record': number, 'reasons': reasons, 'values': values})
        else:
            cleaned.append([values[c] for c in columns])
    buffer = io.StringIO(newline='')
    writer = csv.writer(buffer, lineterminator='\n')
    writer.writerow(columns)
    writer.writerows(cleaned)
    cleaned_raw = buffer.getvalue().encode('utf-8')
    report = {
        'schema_version': 1,
        'synthetic_demo_notice': 'Example fixture is synthetic, not client work; tool does not authenticate data.',
        'source_sha256': sha256(raw), 'config_sha256': sha256(config_raw),
        'transformer_sha256': sha256(Path(__file__).read_bytes()),
        'cleaned_sha256': sha256(cleaned_raw),
        'counts': {'input_records': len(rows) - 1, 'cleaned_records': len(cleaned),
                   'quarantined_records': len(exceptions), 'exact_duplicates_removed': len(duplicates),
                   'field_trims': len(changes)},
        'record_numbering': 'Logical CSV record number, header=1; not physical line number.',
        'duplicate_definition': 'Exact parsed full-row field equality BEFORE transformations, not key equality.',
        'changes': changes, 'duplicates': duplicates, 'exceptions': exceptions,
        'formula_handling': 'Risky rows withheld from cleaned.csv. Original input and JSON retain values; do not open original in a spreadsheet or export exceptions without safeguards.'
    }
    # Validate completely before creating output. mkdir is exclusive, including races.
    output.mkdir(parents=True, exist_ok=False)
    (output / 'original.csv').write_bytes(raw)
    (output / 'cleaned.csv').write_bytes(cleaned_raw)
    (output / 'report.json').write_text(json.dumps(report, indent=2, ensure_ascii=True) + '\n', encoding='utf-8')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', required=True)
    parser.add_argument('--config', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    try:
        report = transform(args.input, args.config, args.output)
    except (ValueError, OSError, csv.Error) as exc:
        parser.exit(2, 'Refused: ' + str(exc) + '\n')
    print(json.dumps(report['counts'], sort_keys=True))


if __name__ == '__main__':
    main()
