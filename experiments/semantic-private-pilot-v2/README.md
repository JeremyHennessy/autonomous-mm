# Semantic private pilot v2: disabled offline candidate

Versioned alternative to the frozen unified-private-pilot. That snapshot, historical runs and ledgers are unchanged. No live question, provider model, forecast, comment, account or deployment was accessed here. Defaults are disabled with no real IDs, source hosts, window, cron or deployment configuration.

## Run

    node --test *.test.mjs
    sh workerd-test/run.sh /path/to/official/workerd

The second command uses already-installed official workerd@1.20261023.1. It creates fresh temporary localDisk SQLite storage, uses in-process fake Metaculus/source endpoints and fake AI, has no sockets and denies outbound Internet. Node fixtures are also synthetic. Passing tests prove code paths and safety invariants, NOT that a real model will interpret prose correctly or produce calibrated forecasts. No live integration, free-quota availability or actual Cloudflare CPU budget is proved.

## Implemented change

The old exact fictional-sentence grammar and global `historyComplete` switch are gone. Structural admission checks the provider IDs, frozen round ID/slug, standalone binary structure, approved/open status, dates, text availability and no own history. Up to 3,600 UTF-8 bytes of complete title/description/resolution criteria/fine print are retained. Provider date parsing accepts explicit-zone ISO timestamps with seconds, milliseconds, or trailing-zero microseconds, validates civil dates and refuses nonzero sub-millisecond values rather than silently rounding an opening time early. The question's forecast-close deadline remains a deterministic operational boundary; semantic event dates are no longer forced to equal it.

The one already-budgeted model call now receives those raw rules plus fixed fetched evidence and returns forecast OR abstention, criterion_summary, uncertainty and rationale. Schema version is semantic-forecast-v2; runtime configuration must explicitly be semanticVersion:2. Interpretation is labeled model judgment, never a deterministic proof. Unknown/conflicting rules, inadequate evidence or unknown relevant freshness are instructed to abstain. Such instruction is fallible; the wrapper cannot prove factual accuracy or semantic understanding from valid JSON.

No tools are offered. Unexpected keys, nonempty tool calls, invented evidence IDs, incorrect question IDs, malformed output, excessive usage, at-cap completion and non-0.001–0.999 publication probabilities fail closed. SchemaFor supplies the actual request schema and the local validator checks it. Summary/uncertainty are bounded and included in the private comment with an explicit model-judgment label. No public comment is added.

## Source authority and prompt boundaries

Before inference, a deterministic parser extracts exact HTTPS references from the supplied rules, intersects them with frozen exact host/directory-prefix rules, deduplicates and takes the first three in document order. A question's claim that a URL is official grants nothing. The model cannot choose a new URL, expand the allowlist, request credentials, invoke a tool or cause a follow-up fetch. The source transport independently rechecks URL restrictions, refuses redirects/query strings/encoded paths/credentials/ports/local names and sends no Authorization or Cookie header. Public source HTTP requests require exact 200, no Content-Range, a full bounded stream, allowed content type and valid UTF-8.

Only complete nonempty source bodies of at most 1,200 UTF-8 bytes enter the prompt. Larger documents abstain rather than silently truncate context. Up to three sources and the complete serialized request still must fit 8,000 UTF-8 bytes. Current supported source types are JSON/plain text/CSV, not HTML rendering/PDF. This is deliberately bounded and may reject many useful real sources. Allowlist ownership/relevance must be reviewed before enabling; hostname strings alone do not prove source authority or DNS safety.

Evidence includes actual fetch URL, actual receivedAt, content hash, raw text and an explicit unknown semantic-freshness label. Retrieval time is not publication/observation time. Dates in source text are available for model interpretation, not asserted by the wrapper. Raw sources and all question text are marked untrusted. No token, private identity response or unrelated provider metadata is included in the model prompt. Prompt instructions do not guarantee immunity from misleading text, but hard capability boundaries prevent text from acquiring tools or changing endpoints.

## Runtime own-history evidence

Transport snapshots one credential internally for its lifetime. It uses that same credential for fixed identity/detail/history/submission requests and never sends it to sources. Identity response is reduced immediately to ID, is_bot, is_active and is_spam. Exact-200 complete-body identity/history receipts are produced by transport, not accepted from provider fields. Fresh same-account identity is read once before discovery and again before final refresh. Wrong/unknown/inactive/spam identity stops the pilot.

verifyEmptyOwnHistory requires the exact requested question row and explicit empty forecast array, fresh receipt, the same active non-spam bot account, no acting_user override, no redirect/partial body, and strict duplicate-key-safe JSON. Missing/hidden rows, null arrays, duplicate rows and any forecast record never become zero. It establishes complete API-visible stored history under the documented provider contract, not unknowable deleted history or atomic server-side absence of concurrent writes. It adds no preparatory live-question call and no special platform completeness flag.

Source rationale: bulk-forecast-read loads all matching author/question forecasts in start-time order without view pagination/slicing. However Forecast.objects filters spam authors; users serializers expose is_spam. API docs describe own data as available and redactions as null. Read-only runtime use can rely on that documented contract while failing closed on unknowns; actual service deployment and gateway behavior remain external assumptions.

- https://github.com/Metaculus/metaculus/blob/main/questions/views.py#L374-L419
- https://github.com/Metaculus/metaculus/blob/main/questions/serializers/common.py#L362-L405
- https://github.com/Metaculus/metaculus/blob/main/questions/models.py#L573-L584
- https://github.com/Metaculus/metaculus/blob/main/users/serializers.py#L31-L104
- https://github.com/Metaculus/metaculus/blob/main/docs/openapi.yml#L19-L40
- https://github.com/Metaculus/metaculus/blob/main/docs/openapi.yml#L2492-L2557

Main links are mutable official-source references, not verified production revision pins. The [history-contract review](../../research/history-contract-review-20261023.md) records the earlier criteria coverage and implementation reasoning.

## Preserved operational boundaries

Permanent per-question claims are reserved before source/model work. Abstention/failure consumes the claim and attempts; no regeneration or blind retry. One outstanding pair, restart-to-UNKNOWN, unknown-write stop, explicit stop/time guards, 20 questions, 5 new questions/day, 5 model calls/day, 24 model attempts total, 3 source attempts/question, 60 source attempts total and a 14-day maximum remain. Because claims include abstentions, 20 is a ceiling, not a promise of 20 successful predictions.

The SQLite ledger persists config hash, clock, counts, consumed states and immutable atomic forecast/private-comment descriptor before dispatch. Direct exact HTTP 201 with an empty JSON object becomes ACKNOWLEDGED only after durable receipt write; it does not create server IDs or prove readback. Ambiguous submission remains UNKNOWN and never retries. A dedicated single writer is required; no API read can eliminate a separate external writer's race.

Final refresh checks actual detail/history and relevant-rule signature. All raw rule text, IDs, operational dates and selected URLs are bound; unrelated provider counters may change without false rule-change failure. Source and history times retain actual transport receipt times, not later processing timestamps. Model/dispatch guards recheck clock, stop, deadline and evidence age before each call.

At most 5 discovery + 24 candidate detail/history + 3 sources + 2 final detail/history + 2 identity + 1 model + 1 atomic write = 38 application dispatches per wake, under the existing 40 ceiling. Managed-binding internals and calling Worker DO request are not exact platform billing counts. Only the first 12 sorted discovered posts are examined; persistent unsuitable first entries can starve others. Discovery termination is not a consistent whole-round snapshot.

Model limits remain 8,000 serialized UTF-8 bytes (NOT tokenization), 24,000-token documented context reservation and 512-output cap, estimated 745 neurons/call, no paid fallback. These are inherited design assumptions, not measured remaining quota or invoices. Real free-plan resource budget and accepted provider behavior require review.

## Verification and remaining limits

Node tests include ordinary prose reaching the same call, forecast and abstention, permanent consumption, no model URL authority, no credentials to sources, unknown source/tool/field rejection, bounded text, actual advancing-clock receipts, partial-body rejection, prior history appearing during model work, changed rules, benign metadata changes, budget/duplicate/restart/UNKNOWN handling and disabled entrypoints. Fake abstention cases prove wrapper handling, not that a real model would choose abstention.

Independent review found and corrected history-clock rebasing, partial source acceptance, source timestamp rebasing, and unrelated full-post metadata causing false change failures. Workerd confirms the local SQLite vertical slice only.

This is NOT a live-ready activation. Before enabling: approve the exact round/protocol and read/inference/publication scope, verify participation/primary bot and current identity, freeze source permissions/ownership, review costs/CPU and timing, pin reviewed artifact/config, and independently retest the final deployed wiring. No authorized metadata-only task is expanded by this candidate.
