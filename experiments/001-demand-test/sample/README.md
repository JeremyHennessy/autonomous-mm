# Synthetic CSV cleanup demonstration

**Synthetic example only. Not client work, a testimonial, a sale, or evidence of commercial demand.**

This small demonstration shows what a reproducible cleanup handoff could provide: a preserved original, a conservative cleaned subset, and an auditable list of changes and unresolved records. It is an offline Python standard-library script, not a hosted application or general-purpose data-quality guarantee.

## Before and after

The fictional input has 9 business records. The agreed demonstration rules produce:

- 3 records in `expected-output/cleaned.csv`, preserving IDs such as `0001`.
- 1 exact full-row duplicate removed, identified by its original logical record number.
- 4 explicit outer-whitespace trims across business-name and city fields.
- 5 records withheld: 2 sharing a conflicting account ID, 1 ambiguous date, 1 missing business name, and 1 spreadsheet-formula risk.

Read `expected-output/report.json` for each change, duplicate mapping, unresolved record, counts, and SHA-256 hashes of input, configuration, transformer, and cleaned output. Counts reconcile: 9 input = 3 cleaned + 5 quarantined + 1 removed duplicate. Some trims can apply to quarantined records; no exceptions are silently resolved.

## Reproduce from the repository root

Requires Python 3.9 or newer. No installation, accounts, network, or customer data are needed. Choose an output directory that does not already exist:

```sh
python src/csv_cleanup.py \
  --input experiments/001-demand-test/sample/synthetic-input.csv \
  --config experiments/001-demand-test/sample/config.json \
  --output /tmp/csv-demo-new-run
python -m unittest discover -s tests -v
```

Compare the three generated files against `expected-output/`. They are byte-for-byte reproducible with identical source/configuration/tool bytes. Reprocessing `cleaned.csv` produces identical cleaned CSV bytes; the second report correctly describes a different input, so reports are not claimed to be idempotent. `test-result.txt` records the observed test count, elapsed test time, and result. That small-fixture timing is not a throughput or customer-delivery promise.

## Rules and safety boundaries

- UTF-8 (optional BOM), comma-separated CSV with exactly the configured header and field counts. Invalid encoding, NULs, malformed quoting, blank records, wrong headers, and malformed row widths are refused before writing output.
- Preserve input bytes in `original.csv`; never overwrite the input or an existing output directory. CSV formatting is standardized only in the cleaned output. Duplicate equality means exact parsed field values before cleanup, not identical source-line bytes, approximate names, or matching keys.
- All IDs remain strings; no numeric coercion, ID trimming, invented values, case folding, inferred dates, or fuzzy merges. Repeated nonempty keys are withheld after the explicit full-row duplicate rule, even when differences look harmless.
- Only configured fields have outer whitespace trimmed. Nonempty dates must be valid YYYY-MM-DD calendar dates; other formats are flagged rather than guessed. Missing required fields are withheld; an empty optional date remains empty.
- Rows whose original fields begin with `=`, `+`, `-`, or `@` after whitespace, or contain ASCII control characters or an embedded BOM, are withheld from cleaned CSV. This deliberately conservative rule also flags some legitimate text. Values remain unchanged in the original and available in JSON; do not open the original in spreadsheet software or export exceptions without safeguards. This is risk reduction for common formula triggers, not certification of every spreadsheet application's behavior. Spreadsheet import can also coerce leading-zero IDs; import ID columns as text.
- Exceptions are JSON, not a second potentially dangerous spreadsheet. Review and agree on resolution rules with the data owner before any further changes; this demonstration does not claim human review has occurred.

## Limits

The script enforces at most 10,000 data rows, 20 columns, a 5,000,000-byte input and a 100,000-byte configuration. Headers with formula/control risks are rejected and the key must be required. The script reads the bounded file into memory. It does not validate real businesses, addresses, emails, consent, customer ownership, or semantic accuracy beyond these explicit rules. It does not support XLSX, non-UTF-8 encodings, arbitrary delimiters, production-scale files, recovery from interrupted disk writes, or safe automatic importing into other systems. If disk writing fails, treat any partial directory as incomplete, inspect it, and choose a fresh output directory for a later run. Real customer delivery needs an agreed scope, privacy-safe transfer/storage, acceptance criteria, and an authorized handling process; never put client data in this public repository.
