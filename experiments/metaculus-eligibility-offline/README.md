# Metaculus eligibility policy, synthetic offline only

This isolated prototype is a pure deterministic policy gate. It does not fetch current questions, access credentials, make model calls, generate forecasts, submit anything, deploy, or alter existing runtimes. A pure raw-shape normalizer is implemented; no live transport or production admission bridge is implemented. Every output says `liveUseAllowed: false`; a mandatory `synthetic: true` input is not authorization or real evidence.

Run with Node, no install:

    node --test test.mjs provider-shape.test.mjs

`evaluate(JSON.stringify(input), expectedProtocolDigest)` returns a complete batch verdict and per-candidate decisions. All envelope names in `gate.mjs` are explicitly LOCAL normalized contracts, not claimed Metaculus response fields. A positive fixture proves predicates over synthetic facts only. It cannot verify caller truthfulness, authenticity, provider access, a real round, or absence of concurrent changes. JSON-only input avoids accessor execution. Shared strict-json.mjs rejects duplicate object keys, including escaped-equivalent keys, rather than allowing last-key-wins evidence erasure. Hashes bind content, not authenticity. The caller-supplied current/previous clocks and completeness flags are trust inputs; the gate cannot establish a monotonic real clock, authenticated transport, or snapshot consistency by checking assertions alone.

## Concrete provider-shape adapter

`provider-shape.mjs` exports `normalizePost`, `normalizePage`, and `normalizeOwnForecastRead`, each accepting serialized JSON. They map the official response fields below using only synthetic provider-shaped fixtures. Each observed field is tagged `value`, `missing`, `null`, or `invalid`. Nested malformed records are retained with missing/invalid fields rather than silently dropped. IDs, account IDs, Unix history timestamps, date strings and probability arrays remain distinct. Date strings require explicit zones and valid civil dates; source precision is preserved, not silently reduced to a canonical gate timestamp.

`shapeReadable: true` means a top-level JSON object was readable, NOT that all fields passed validation. Consumers must inspect every required observation's state. All normalized outputs explicitly say `eligibilityProven: false` and `liveUseAllowed: false`. The adapter preserves tournament arrays and the separate default-project object, post/question IDs, all statuses, date fields, criteria text, own history and page cursors. Source-backed `conditional`, `group_of_questions` and `notebook` content discriminators are retained separately (including conflicting presence), without inferring standalone eligibility. It does not infer standalone status from absent group fields, unresolved status from null resolution, no history from an omitted record, or complete enumeration from a terminal cursor. Snapshot consistency, own-account authentication and complete history remain explicitly unknown.

There is deliberately no automatic bridge from provider observations into trusted gate assertions yet. Read-only discovery can use the shape adapter independently while future admission waits on detail freshness, identity/history evidence, exact round membership and a real deterministic criteria parser. No manual-per-question review requirement is introduced.

## Implemented checks

- Exact positive integer round project ID and account ID, frozen round open/close and pilot start/end, maximum 14-day pilot. No moving string aliases. A separately supplied trusted protocol digest must match the complete protocol, and the snapshot digest must match it too. The caller must persist/freeze that anchor outside the incoming snapshot and must not recompute it from untrusted inputs. The gate cannot protect a caller that deliberately replaces its trust anchor.
- Canonical UTC timestamps with milliseconds, real calendar dates, finite clocks, non-rollback comparison of supplied clock timestamps (no retained clock state), fresh observations, start-inclusive/end-exclusive windows. Maximum evidence age is explicitly configured and capped at five minutes. This is a local conservative policy, not a provider guarantee.
- Distinct POST_ID and QUESTION_ID namespaces, explicit verified mapping from post to standalone question; equal numerical IDs are permitted but one is never inferred from the other.
- Standalone binary only; exact approval/open/unresolved facts. Groups and conditionals are unsupported. Missing, null, false and truthy strings are not interchangeable.
- Mandatory open, effective close/resolve and scheduled close/resolve instants. Conservative ordering rejects missing or inconsistent dates and closed/scheduled/not-yet-open candidates. Real mapping of effective dates is not implemented; particularly, a null actual resolution time must NOT be interpreted as a known future resolution time.
- Criteria include description, resolution criteria and fine print. Only the tiny deterministic `synthetic-rule-v1` grammar passes: a fictional binary marker, an exact close timestamp, an exact synthetic source, and explicit abstention for any missing/nonbinary observation. Nonempty arbitrary text and `unambiguous: true` assertions alone cannot pass. Description and fine print must exactly match the supported template. A digest binds criteria/dates to the exact post/question IDs. This is NOT a general-language ambiguity detector. A future real parser must abstain on unsupported or ambiguous rules, not require human approval for every question by default.
- Own-history proof must be explicitly complete, authenticated for the frozen account, match the question, be fresh and no older than the snapshot, and state an integer count of exactly zero. Missing/null/omitted records are never zero. All prior forecasts disqualify, including ended forecasts.
- Complete pagination requires a local transport attestation, consistent snapshot attestation, contiguous offsets, terminal-page agreement and exact total records. Empty intermediate pages, missing pages and duplicate post OR question IDs fail the entire batch closed and return no eligible candidates. A short page is not proof of completion. No partial candidate results escape a batch failure.

## Provider mapping boundary and official references

Official source inspection on 2026-10-23 identified these fields, not a production integration test:

- GET `/api/posts/` uses `tournaments=<frozen slug>`, `statuses=open`, `forecast_type=binary`, `include_descriptions=true` (plural), `limit` and `offset`.
- Its envelope is `{next: string|null, previous: string|null, results: Post[]}`. The reviewed contract supplies no total count or snapshot-consistency guarantee. `totalRecords`, `paginationComplete`, and `snapshotConsistent` above are LOCAL synthetic assertions, not provider properties and not facts inferred from this envelope. A real stable enumeration proof is unresolved; do not mark real batches valid by setting these flags optimistically.
- `post.projects.tournament` is an array of project objects with integer `id`, nullable `slug` and `type`; `default_project` is one object, not an array. Membership must use the tournament array and frozen numeric ID plus exact slug, not default-project inference.
- `post.curation_status === "approved"`, `post.status === "open"`, and `question.status === "open"` are distinct checks. Null actual resolution does not prove unresolved.
- `Post.id` is POST_ID. `Post.question.id` is QUESTION_ID. The question exposes `type`, `status`, `open_time`, `scheduled_close_time`, `actual_close_time`, `description`, `resolution_criteria`, `fine_print`, and `my_forecasts` in the reviewed source. Our camelCase/local booleans are not direct provider names.
- GET `/api/questions/bulk-forecast-read/?question_ids=Q` returns `{results: [{question_id, forecasts: [...]}]}`. An explicit visible question with `forecasts: []` differs critically from an omitted/invisible question. Forecast records include `question_id`, `author_id`, Unix `start_time`, nullable `end_time`, and binary `forecast_values: [1-p,p]`. Correct authenticated identity and complete history still need verification. No request was made here.

Official sources:

- https://github.com/Metaculus/metaculus/blob/main/docs/openapi.yml
- https://github.com/Metaculus/metaculus/blob/main/questions/views.py#L361-L419

The source also exposes `question.post_id` (must equal post.id), `scheduled_resolve_time`, nullable `actual_resolve_time` and nullable `resolution_set_time`. `actual_close_time` is derived: stored actual close if present, otherwise the scheduled close or an earlier actual resolution. A future nonnull actual close therefore does not imply closure. `my_forecasts` is an object with `history`, `latest` and `score_data`, emitted conditionally in backend source; missing/null must fail closed. The adapter must normalize supported timestamps without confusing Unix history timestamps and date strings.

Backend `serialize_post` adds `question`, `conditional`, `group_of_questions`, and `notebook` only when the relation exists. Omission is normal backend behavior; gateway behavior is not production-verified. Explicit null remains a distinct observation and is not upgraded into proven absence.

Additional official source references:

- https://github.com/Metaculus/metaculus/blob/main/posts/serializers.py#L343-L395

- https://github.com/Metaculus/metaculus/blob/main/projects/serializers/common.py#L73-L170
- https://github.com/Metaculus/metaculus/blob/main/posts/serializers.py#L319-L345
- https://github.com/Metaculus/metaculus/blob/main/questions/serializers/common.py#L35-L134
- https://github.com/Metaculus/metaculus/blob/main/questions/serializers/common.py#L632-L695

No undocumented `approved`, `standalone`, `mappingVerified`, `criteriaReview`, `ownHistory`, or pagination-proof fields are attributed to Metaculus. The raw-response shape adapter deliberately does not synthesize those guarantees. Pin/review the actual provider revision before implementing one; `main` links are mutable references, not a frozen production schema.

## Remaining gates

Official source mappings above must still be pinned, implemented and integration-verified for real round membership, approved/open state, all required dates and authoritative authenticated own history. Freeze exact project ID AND query slug and round dates before any live question inspection, with no `current`/moving alias. Implement a reviewed deterministic real criteria parser or abstain. Discovery traversal completeness and provider snapshot consistency are separate: terminal cursors can establish traversal termination, not absence of concurrent mutations. Future integration must use fresh individual detail and authenticated history immediately before submission, plus ledger reservations; normalized observations alone prove neither freshness nor clarity. A globally consistent discovery snapshot is not a precondition to implementing or using read-only shape normalization, but this conservative synthetic batch gate continues refusing eligibility without its explicit evidence contract. Connect the gate to the already separately reviewed durable one-shot submission/stop/budget controls only after explicit authorization. This prototype has no production admission capability and does not relax registration, primary-bot, identity, spending or publication gates.

All fixtures are fictional. The reviewed offline scope passed 75 tests, including duplicate-key rejection and the separately supplied protocol-digest anchor. This snapshot does not modify historical runtime evidence.
