# Offline admission-contract review, 2026-10-23

No current questions, account endpoints, token, model, runtime or external writes were used. Only public official source was read. This source review informed the separate disabled semantic candidate. Its [history helper](../experiments/semantic-private-pilot-v2/history-empty.mjs) is not an enabled production adapter.

See the [candidate test instructions](../experiments/semantic-private-pilot-v2/README.md).

## Finding: replace the unexplained global historyComplete flag with evidence

The documented bulk read returns the acting account's history, includes visible requested questions with empty arrays, and omits invisible/nonexistent questions. The implementation filters viewable questions, loads author/question-filtered forecasts oldest-first, and serializes one row per question. There is no view-level pagination, slice, time cutoff, active-only filter or count limit. MyForecastSerializer serializes each supplied record; it does not slice the list. Therefore the ordinary authenticated runtime read can establish complete API-visible stored history without a separate preparatory live-question inspection.

Primary sources:
- https://github.com/Metaculus/metaculus/blob/main/docs/openapi.yml#L2492-L2557
- https://github.com/Metaculus/metaculus/blob/main/questions/views.py#L374-L419
- https://github.com/Metaculus/metaculus/blob/main/questions/serializers/common.py#L362-L405

Caveat found by following the model manager: Forecast.objects excludes authors marked is_spam. An empty result is not unconditional proof that no database history exists. The public user serializer exposes is_spam, is_active and is_bot; the private serializer inherits them. A fresh trusted same-account identity receipt with explicit is_spam:false resolves this observable condition for normal runtime operation. Missing/null/true does not. No new live request was made or authorized to obtain that value here.

- https://github.com/Metaculus/metaculus/blob/main/questions/models.py#L573-L584
- https://github.com/Metaculus/metaculus/blob/main/users/serializers.py#L31-L104

The gateway is closed source; the official docs describe own data as available and redactions as null. Relying on the documented authenticated contract is reasonable, with strict unknown/error rejection. This is not a demand to prove unknowable database truth, deleted history or atomicity across reads. It does not establish no competing external writer between history read and submission.

- https://github.com/Metaculus/metaculus/blob/main/docs/openapi.yml#L19-L40

These main links are mutable source snapshots, not proof of the deployed backend revision.

## Minimal integration correction

1. Keep the existing runtime detail/history request and final refresh. Do not add a preparatory question call merely to test completeness.
2. Replace static config.historyComplete with a runtime result from verifyEmptyOwnHistory, constructed using trusted request/response provenance. The helper requires exact requested question ID, exactly one row, an explicit empty forecasts array, no partial/pagination extensions, the same authenticated account, no acting_user override, bounded complete body, exact HTTP 200, no redirect/content-range, and fresh identity/history receipts. Any forecast record, even malformed/ended, disqualifies. Omitted rows are unknown, never empty.
3. The current transport accepts arbitrary 2xx and returns only `.data` for history. Preserve status/receivedAt/full-stream completion and reject 206 or Content-Range before constructing evidence. EOF plus fatal UTF-8, strict duplicate-key JSON, size/time caps and schema checks establish transport completeness. Do not demand Content-Length equality against decompressed bytes; compression makes that comparison invalid.
4. Acquire/retain only necessary identity fields from an authorized same-token identity read: ID, is_bot, is_active, is_spam and receipt time. The helper's receipt is local transport evidence, not invented provider fields or caller-controlled flags. Do not persist the full private user response. Current runtime authorization and schedule must separately cover such a read; do not add one silently to a currently authorized metadata task.
5. Keep permanent per-question ledger claims, no UNKNOWN retry, one outstanding pair, authentication-error halt, and final fresh history check. For the pilot, one dedicated writer/account avoids competing submissions. API history absence plus durable claims is the practical no-duplicate contract; it is not atomic server-side uniqueness or a claim about erased historical data.
6. All proposed positive results remain liveUseAllowed:false here. Integrate only after builder review, version/config-identity updates and complete suite/runtime retest. Never merely flip historyComplete to true.

## Exact current deterministic criteria coverage

Inspected unified-private-pilot/admission.mjs and model.mjs on this date. No active or historical real question text was inspected.

Both accepted forms require description exactly `Resolve using only the linked machine-readable source.` and fine_print exactly `Missing or conflicting source data means abstain.`

1. `Resolves Yes if metric "NAME" in unit "UNIT" is OP NUMBER at TIMESTAMP, otherwise No. Source: HTTPS_URL`
2. `Resolves Yes if event "NAME" has occurred by TIMESTAMP, otherwise No. Source: HTTPS_URL`

NAME permits an ASCII letter then up to 63 ASCII alphanumeric/underscore/hyphen characters. UNIT allows the same with 31 trailing characters. OP is exactly >=, >, <= or <. NUMBER is a finite non-exponent decimal. Timestamp must be canonical UTC milliseconds. URL must be canonical HTTPS without credentials, fragment or nondefault port; the separate source transport further rejects query strings and requires a frozen host/directory allowlist. Target time must equal scheduled_close_time. Evidence must be exact custom JSON keys: source_url, metric, unit, value, observed_at; or source_url, event, occurred, observed_at. Observation must be at most five minutes old and not after target.

Thus these are synthetic templates with possible real applicability, NOT demonstrated real-question coverage. Unsupported: ordinary narrative or Markdown, alternate wording/punctuation, multiple sources, ties/cancellations/revisions, later resolution targets, entity aliases, ranges/compound conditions, dates in human notation or noncanonical zones, qualitative events, non-JSON source formats, uncertainty clauses, fiscal periods, scientific notation and arbitrary description/fine-print context. A nonempty ordinary question will usually abstain before any model call.

## Practical alternative: one-call semantic judgment, not fictional grammar

The existing validator already supports forecast OR abstain (null probability), source-ID membership, bounded rationale, no tool calls, strict schema and usage. Runner permanently consumes model-abstained questions; it does not regenerate. Existing requestFor currently receives only parsed criteria/admission output, so merely loosening the regex would NOT supply the complete original rules to the model.

Smallest useful reviewed design:

- Split structural admission from semantic interpretation. Keep deterministic IDs, exact round membership, binary/standalone status, open deadlines, same-account empty history, bounded full text availability and source fetch restrictions. Unknown/redacted rule fields still abstain. Do not require targetTime==forecast close as a universal semantic truth; operational close remains authoritative for dispatch.
- Before the single model call, deterministically extract at most three exact HTTPS references from supplied rule text using a fixed parser. Intersect with frozen approved source host/path rules, deduplicate and respect remaining byte/request budgets. Do not fetch URLs found in model output or recursively follow links in source material. If no usable approved source exists, abstain. Extraction alone is not source endorsement; allowed hosts/paths require prior ownership/relevance review.
- Feed bounded title, description, resolution criteria, fine print and relevant provider dates verbatim as explicitly untrusted data, alongside already-fetched source excerpts and fixed source IDs. Do not include token, identity response, private account attributes, aggregate forecasts or unrelated context. Preserve source retrieval time separately from reported publication/observation time; current retrieval is not proof a fact is current. Missing dates remain unknown, with model abstention where freshness matters.
- Use the same one budgeted model invocation to interpret rules and forecast OR abstain. Require ambiguity, insufficient evidence, unclear entities/timezones, conflicting resolution clauses, or unsupported source freshness to yield abstention. This is probabilistic judgment, NOT demonstrated unambiguous interpretation or a semantic proof.
- Version the schema to add bounded criterion_summary and uncertainty strings, while retaining fixed question ID, existing evidence IDs, status, probability and rationale. Existing validator rejects new fields, so both request schema, normalizer/validator and tests must change together. Keep no-tools and 512-output cap, input byte cap, whole-context cost reservation and no retry/fallback. Reject truncated output rather than raising the cap. A criterion summary is auditable, not a machine-proof of correctness.
- Retain strict post-model probability range, source-ID set, renewed provider/history checks, exact rule-text/content binding and unchanged one-shot durable submission. Output URLs are never interpreted as instructions or grants. New semantic fields remain private audit metadata; the accompanying private rationale can briefly state interpretation and uncertainty, within existing size limits.

Required synthetic regressions before integration: ordinary prose threshold/event examples; explicit ambiguity and conflicting fine print abstain; missing/source-outdated evidence abstain; injected instructions cannot add tools, URLs, sources or fields; raw criteria survives prompt packaging without privilege; unknown IDs rejected; no model-derived network request; one attempt on abstention/failure; fresh-history mismatch blocks; changed criteria after inference blocks. Test structural invariants rather than pretending deterministic unit tests establish the model's factual accuracy.

Recommendation: this one-call design is more useful than adding a few English regex variants. It removes the artificial exact-sentence gate without promising language certainty or expanding model/tool authority. An offline schema/prompt proposal is justified now; deployment/read/inference/publication remain separate authorization gates.
