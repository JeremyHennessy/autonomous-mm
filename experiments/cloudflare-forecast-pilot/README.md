# Cloudflare forecasting safety prototype, offline only

This is a deliberately non-deployable safety prototype, not an autonomous live bot. No actual Metaculus questions were inspected. This prototype does not perform model/API/source requests, access credentials, install dependencies, deploy resources, make external submissions or spend money. Separate experiments are not evidence of this prototype’s integration readiness.

## Run locally

Requires Node 22.13+ with built-in `node:sqlite` (verified here on Node 24.19.0):

    node --test test.mjs

There is no package install and no package/deploy script. Tests use fictional inputs and SQLite memory/temporary databases. They do not read environment variables, credentials or provider accounts. Delete only test databases you created; never erase a pilot ledger to restart a stopped run.

## Architecture and hard limits

- `worker.mjs`: one Worker entrypoint and one SQLite Durable Object class. `handlers.mjs`: HTTP always returns 503; scheduled events and `tick()` always return disabled. No environment flag enables live execution. No public state, token, logs or administration endpoint. The only mutating DO RPC is an internal stop operation.
- `core.mjs`: synchronous SQLite transactions atomically reserve a single global pilot's question, source, inference and mock-side-effect budgets before returning control to any adapter. The entire pilot is the coordination unit, avoiding fragmented limits across instances. No I/O inside a transaction. One in-flight operation is admitted at a time. Storage errors poison that controller instance. Reserved operations recovered after restart become uncertain and permanently stop the run; reservations are never refunded.
- Fixed SHA-256 configuration identity, verified by tests and checked against every persisted ledger. Frozen window: 2026-10-22 00:00 UTC through 2026-11-05 00:00 UTC, exclusive deadline; no sliding start. A future authorized experiment needs a separately reviewed frozen protocol and fresh identity before inspecting any real question. Config hashing is not protection against malicious code/database rewriting.
- At most 20 synthetic binary questions, 5 new questions/day, 5 inference reservations/day and 24 overall, failures included. This stricter prototype permits only ONE inference reservation per question, so its reachable overall maximum is 20, not 24. No retries are implemented. This does not confer permission to use remaining headroom. A 25-entry corrupt attempt ledger is rejected separately.
- At most 3 source reservations/question and 60 overall. No actual source adapter or URL fetching exists. All counts use UTC days. Invalid/rolling-back clocks, deadline, stop, state/config mismatch and uncertain operations fail closed.
- Each inference reserves 8,000 input and 2,000 output tokens before the mock call. Mock token proofs are explicitly synthetic and match the exact fixture prompt. They are NOT verified production tokenization, and character length is never represented as an exact token count. Real inputs must abstain until a model-specific tokenizer or provable conservative whole-request upper bound is implemented and verified, including chat/template overhead. The future model is the named plain Llama 3.3 model; no hidden-reasoning model/fallback is selected.
- Valid forecasts cannot be regenerated. Forecast/comment reservations are unique per question and kind. Every forecast atomically reserves both immutable synthetic payload envelopes, with question/effect identity, SHA-256 content digest and the comment’s link to the forecast digest. The next forecast is blocked until the preceding forecast AND comment are confirmed. A comment needs its confirmed forecast. Effect adapters receive a detached envelope and must acknowledge that exact envelope; swapped, stale, modified or unbound receipts stop the run. Uncertain acknowledgement globally stops the run and cannot be retried; there is no reconciliation/re-enable API. Post-inference stop/deadline rejects the result without discarding the spent attempt.
- Only whitelisted synthetic receipt fields are stored, labeled `origin: mock`. A provider receipt is rejected, never passed off as a mock or as evidence of actual inference, billing, accuracy, submission or revenue.

## Integration gates, all CLOSED

1. Obtain explicit deployment/activation authority for this separate project. No code here changes provider/account settings or secrets.
2. Independently verify actual free-plan quota, $0 new spending protection, model availability and resource usage. Reported eligibility is not an independently enforced quota or cost guard. Daily inference count does not enforce a provider's neuron/billing budget. This prototype has no live cost guard and cannot claim one.
3. Verify current official Workers AI model/bindings/types, SQLite Durable Object transaction/durability semantics and Wrangler schema. The offline test suite does not verify current online provider specifications. No Wrangler/miniflare/Cloudflare integration or production type checking was run. Node SQLite validates application transaction behavior, not Cloudflare's actual runtime.
4. Implement and test a proven whole-request input bound, output/usage accounting, timeouts, authoritative clock/error handling, model identity and provider receipt schema before any AI call. The `env.AI` binding is shown only in the inert example; `runWorkersAI` throws unconditionally.
5. Verify official Metaculus API schemas, eligibility, terms, bot identity and bounded publication authority, with approved secure credential handling. `metaculusAdapter` throws unconditionally. No token is needed for these tests. Do not paste/store one here.
6. Freeze sampling/protocol before reading real questions. Review calendar start/end and a code artifact digest as part of the actual protocol; this prototype pins configuration only, not the entire code artifact. Implement real question eligibility, source allowlisting, request/response size limits, prompt injection defenses and calibration/output validation.
7. Independently test real deployment concurrency, storage failures, scheduled delivery duplication, restart, exact-once/idempotency reconciliation and kill switch. Do not retry uncertain external effects. No automatic rearm or storage deletion. Private operational receipts and provider receipts must remain separate from synthetic test artifacts.

`wrangler.example.jsonc` is a reference, not an operational config. It has no active cron, account ID, route or secret; workers.dev and preview URLs are disabled. Its entrypoint deliberately does not exist, preventing accidental deployment even with `--config`. Do not fix that guard before approval and integration review. Runtime flags alone never activate the code.

## Reference links for a later authorized verification

- https://developers.cloudflare.com/workers-ai/platform/pricing/
- https://developers.cloudflare.com/workers-ai/configuration/bindings/
- https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- https://developers.cloudflare.com/durable-objects/platform/pricing/
- https://developers.cloudflare.com/workers/platform/limits/

## Frozen round and eligibility refinement

The fixture protocol now additionally pins `SYNTHETIC-ROUND-NOT-REAL-001` and its synthetic close at 2026-10-29 00:00 UTC. Admission requires that exact round ID AND close; moving aliases and mismatches are rejected. The earlier of round close and the 14-day cap governs all operations. The twentieth confirmed forecast acknowledgment blocks all new questions, inference, source work and forecasts. Before EVERY forecast is dispatched, the same atomic transaction reserves one held immutable intent for its required accompanying comment. Prior pairs must both be confirmed before another forecast can start, so at the cap there are exactly nineteen confirmed comments and one held final comment. Only that exact comment may then be dispatched once under the accepted-limit stop, after forecast confirmation. There can be no earlier missing comments in a valid ledger; duplicate comments remain blocked. Explicit stop, clock errors, round close, the hard deadline, auth failures and uncertain acknowledgments still block it. A held intent proves no comment has been dispatched and can survive restart; once promoted to in-flight, restart makes it uncertain and non-retryable. Read-only ledger inspection remains available and does not mutate SQLite. No external reconciliation adapter is implemented. A real round ID/end must be frozen and verified before inspecting actual questions; this synthetic identifier must never be used as real eligibility evidence.

Live submission additionally requires verified participation form completion and primary-bot designation; this source snapshot supplies no such evidence. Competition eligibility and payout terms require a separate current-source review; offline tests do not establish prize eligibility. This is operational learning with conditional prize eligibility, not likely income or promised revenue.

Correction verification: 28 offline tests cover final-comment pre-reservation, cap/restart completion, no twenty-first work, duplicate blocking, explicit stop/deadline/clock precedence, uncertain comment acknowledgement and read-only inspection. The configuration/state version was advanced to 3, rejecting older ledger identities rather than silently migrating them.

## Pair-linkage repair limitations

The SHA-256 helper uses Node’s built-in `node:crypto` only in this offline harness. No dependency was installed. Worker compatibility/bundling remains unverified and gated; the deliberately invalid Wrangler entrypoint remains unchanged. Digests identify exact synthetic payloads, not authenticity, provider signatures, or protection from malicious ledger rewrites. Only effect receipts are envelope-bound; inference/source receipts remain synthetic budget fixtures, not production evidence. Old version-2 ledgers fail closed; this change does not migrate, reset or rearm them. This source snapshot excludes separate experiments and operational receipts.
