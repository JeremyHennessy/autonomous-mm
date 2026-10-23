# Unified private pilot candidate: disabled, OFFLINE verification only

One implemented vertical slice, not a collection of disconnected helpers. Production defaults are inert: fetch always returns 503, scheduled handler immediately returns, no configured cron, public/preview routes off in example, no real account/round/hosts/window. No existing deployments, ledgers or historical artifacts changed. No external requests, model calls, token handling or publication occurred in this work.

## Run

Node 24, no dependencies installed:

    node --test *.test.mjs

Actual workerd local SQLite DO integration, using the already installed official workerd@1.20261023.1 executable:

    sh workerd-test/run.sh /path/to/workerd

The test config has no sockets or Internet service. Global outbound fetch routes to an in-process fictional Metaculus/source service, whose own outbound routes to a deny service. A freshly created temporary directory holds local synthetic SQLite data. Model output comes from an injected plain fake AI binding; this is not a real provider call. The wrapper, RequestInit, stream handling, SQL/transactionSync/storage.sync, blockConcurrencyWhile, RPC status/tick and exact pair transport execute in real workerd. Actual Cloudflare distributed durability and live AI binding are not thereby proved. No production scheduling is exercised or installed.

## Implemented chain

worker.mjs uses official DurableObject import and wiring.mjs. Fixed-object scheduled entry invokes Pilot.tick; no public trigger/control endpoint, no caller-supplied prompts/IDs/URLs. Only existing-token getter and future AI/DO bindings are needed; no account-management credentials. Disabled code never reads env.

runner.mjs discovers a bounded frozen-slug batch, sorts/deduplicates, inspects at most12candidate IDs per wake, reads detail and own history, and runs admission.mjs. Actual source-backed provider field names are checked; no synthetic eligibility envelope is accepted as provider data. Discovery completion is not a global snapshot guarantee. Actual receipt timestamps are distinct and bounded; detail/history are read again before publication. Unknown/unsupported criteria abstain automatically, with no human per-question tuning. Parser is intentionally tiny exact threshold/event grammar; it may admit zero real questions. historyComplete is an explicit unresolved local trust gate, NOT an API field or inferred from empty history. It is false in production config. Account/participation/primary-bot configuration also remains unverified here.

Transport uses only fixed https://www.metaculus.com API paths, explicit Token header, no supplied cookies, redirect:manual with every 3xx rejected, no URL follow, bounded time/decoded body/UTF8/JSON/pagination. Source fetch reads no token, accepts only frozen exact HTTPS hosts and directory path prefixes, rejects query/encoded/nested/proxy-looking URLs, IP literals/local names/ports/userinfo and redirects. Allowlist cannot expand from source/question instructions. Domain ownership and safe public DNS remain predeployment review requirements; string validation is not a claim of general DNS-rebinding resistance. Public JSON evidence is bounded, dated and locally parsed; unsupported/missing/stale/conflicting data abstains. No web search, paid feeds, arbitrary crawling, browser rendering or PDF extraction.

The SQLite ledger atomically records fixed config hash, monotonic clock, per-question consumed intent and budgets: 20 questions, 5 new questions/day, 5 model attempts/day, 24 attempts total, 3 source attempts/question, 60 total, a 14-day maximum and an earlier round end. Failed attempts stay spent. One process busy guard plus persisted unfinished states prevent duplicate progress. Restart marks unfinished work UNKNOWN and stops. Binding resolution and valid numeric usage are saved, not raw errors. Uncertainty/storage/auth/time errors stop; no automatic retry, reset or reconciliation release.

After strict model normalization/validation, recheck detail/history/evidence freshness, construct exact single-forecast/single-private-comment JSON and persist immutable descriptor/digest. Immediately before each network dispatch, synchronous guard rechecks authoritative time and transactionally records the last observation, relying on DO output gates for outbound ordering; no awaited operation intervenes. A directly awaited exact HTTP 201 with an empty JSON object correlated to that descriptor becomes ACKNOWLEDGED only after durable receipt write. This permits the next distinct pair. It is not server readback CONFIRMED, creates no IDs and asserts no server idempotency. Timeout, conflicting receipt or acknowledgment-storage uncertainty is UNKNOWN and permanently blocks sequencing. No separate comment write or automatic submission retry exists. Read-only reconciliation remains unimplemented because no authoritative request-to-pair proof is established; UNKNOWN cannot be cleared by matching text/value/time.

## Input and cost bounds: revised future-design contract

This unactivated design uses an 8,000 UTF-8-byte ceiling on the serialized model request, including schema and messages. Bytes are NOT exact tokens. The model's documented 24,000-token context is the conservative input reservation, plus 512 output tokens; oversized/provider failures consume one attempt and stop. Existing copied validator was generalized from synthetic IDs to Q-/S- and forecast-v1, and input usage maximum changed to 24,000 for this distinct candidate. Strict shape/source/null/usage rules remain. max_tokens 512 and at-cap rejection remain.

At documented 26,668 input and 204,805 output neurons/million, ceil(24000*26668/1e6+512*204805/1e6)=745 neurons reserved/call, at most 3,725/day for 5 calls. This assumes the documented managed-model context limit bounds accepted input, including its template; it is not independent tokenizer/template verification or an invoice guarantee. No counting endpoint/template upper-bound guarantee was found in the narrow official-doc check. Returned usage is validated, not used to retroactively claim an exact predispatch count. Current 10,000/day free allocation is shared; remaining quota has not been measured. No free-tier entitlement or billing reconciliation is established by this snapshot; no paid fallback or upgrade is enabled. Runtime CPU/request/storage limits still need actual platform budget verification; local workerd is not a free-tier CPU meter.

## Remaining gates before any live proposal

Pin exact API/backend revision; verify real round metadata and eligibility; establish authenticated complete-own-history semantics; freeze permissible source-host ownership and useful admission grammar before inspecting questions; review actual source freshness/evidence adequacy. This code does not establish forecasting skill from one metric reading or from valid JSON. Confirm private-comment contest requirements. Establish live runtime resource budget and accepted documented-context cost assumption. Review schedule/stop/cleanup plan and authorize actual reads/inference/publication separately. Existing identity success is not publication authority. No deployment-ready binding/migration/secret setup is supplied in the example.

## References and provenance

- https://github.com/Metaculus/metaculus/blob/main/docs/openapi.yml
- https://github.com/Metaculus/metaculus/blob/main/questions/views.py
- https://developers.cloudflare.com/workers/runtime-apis/request/
- https://developers.cloudflare.com/workers/runtime-apis/fetch/
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/
- https://developers.cloudflare.com/workers-ai/platform/pricing/

Provider mappings reuse prior official source review; mutable main URLs are not pinned deployment contracts. deps/ includes copied strict JSON parser and modified pure forecast validator plus unchanged narrow binding normalizer. Historical originals remain untouched. Workerd test initially used inMemory storage, which does not provide this SQLite API, so it now uses isolated localDisk test storage. An RPC service fake adds a disposal symbol rejected by the strict normalizer; test now injects a plain binding-shaped fake rather than weaken production shape checks. Neither issue is attributed to an actual WorkersAI response.

Final verification: 91 Node tests and fresh actual-workerd SQLite vertical slice independently passed. Review repaired clock rollback, receipt freshness, descriptor expiry, and tested distinct-pair HTTP 201 sequencing and acknowledgement-flush failure. Browser-only credentials/referrerPolicy RequestInit properties are omitted; exact explicit headers and never-follow redirects enforce the relevant boundaries. No raw production logging is present.

Per-wake application dispatch budget is 40, synchronously consumed by each actual HTTP dispatch callback and model invocation; no network operation can bypass it through these adapters. Independently, at most 5 discovery pages + 24 candidate detail/history calls + 3 source calls + 2 final refresh calls + 1 atomic POST + 1 model-binding invocation = 36 application dispatches, plus the calling Worker DO invocation. Evidence/model/publication run for ONE admitted candidate per wake, never per rejected candidate. All redirects are rejected, never followed. Managed binding internals are not independently metered; provider/platform errors still stop without retry. This is not a claim of exact billing/subrequest accounting or free-tier CPU compliance. Only the first 12 sorted candidate IDs per wake are inspected. Repeatedly unsuitable first 12 can starve later candidates: report zero/admission cutoff rather than silently scan beyond the bound. A future frozen cursor policy requires separate implementation/review. No complete-round enumeration or autonomous schedule is claimed.
