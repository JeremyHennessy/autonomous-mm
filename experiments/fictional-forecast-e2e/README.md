# Fictional end-to-end forecasting rehearsal

OFFLINE ONLY. No HTTP client, credentials, real questions, inference, Worker deployment, routes, cron or contest publication. All outputs carry synthetic:true and liveUseAllowed:false. This is a runnable integration of existing tested pieces, not a production eligibility parser or successful real forecast.

Run Node 24 (built-in SQLite), no install:

    node demo.mjs
    node --test test.mjs

The demo uses a fictional fair coin and prints one mock acknowledged atomic forecast/comment pair. Every adapter is injected; the demo/tests supply local functions only. Do not replace them with real transport without separate integration review and authorization.

## Concrete path

1. Strict serialized JSON fixture is mapped through the provider-shape normalizer. Required observed IDs, separate post/question mapping, status, dates, criteria and exact fictional round membership must agree with the explicit synthetic admission envelope.
2. The existing eligibility gate validates frozen protocol digest, round/pilot windows, criteria grammar, own-history and pagination assertions. Those authenticated/complete/standalone assertions remain deliberately supplied synthetic facts. The bridge does not establish them from provider data. Its future actual resolution date is a fictional test fact, not a valid assumption about an unresolved real question.
3. SQLite atomically reserves a new question and supplied-source slots. Missing or conflicting synthetic evidence abstains before a model call. An agreed fictional source probability is a test oracle, NOT a real forecasting method.
4. Reserve one mock inference attempt before calling the injected model. Build the existing compatible nullable JSON-schema request with fixed model, messages only, stream:false and max_tokens 512. Narrow provider-shape normalization and unchanged strict semantic validation reject malformed/ambiguous output, bad IDs/sources, missing/inconsistent usage or output at cap. All response/usage/HTTP evidence is mocked, not an actual provider receipt.
5. Re-read synthetic detail/evidence, re-run eligibility, bind unchanged raw content and evidence. Construct the existing immutable atomic descriptor with exactly one binary probability and one private accompanying comment. Probability range 0.001–0.999 is enforced without clamping. No acting_user or public run marker.
6. Persist descriptor and submission reservation before calling mock submit. Final clock/freshness/eligibility/descriptor-expiry checks precede invocation without an intervening await. No valid forecast rerun or second atomic pair.
7. HTTP 201 with an empty object with exact mock request correlation yields ACKNOWLEDGED, not invented IDs or CONFIRMED. The next pair waits for explicit synthetic authoritative reconciliation. Absent/stale/partial evidence stays unknown; the real API does not currently provide the authoritative correlation mechanism assumed by that fixture. Submission timeout or uncertainty stays UNKNOWN and permanently stops further work; there is never an automatic retry. Late results cannot overwrite the recorded outcome.

## Durable safety and caps

Single local SQLite row stores frozen configuration hash, monotonic observed clock, stop flag, budgets, reservations and exact descriptor. BEGIN IMMEDIATE/COMMIT makes each state transition atomic. Duplicate invocation cannot change another operation's reservation. ADMITTED/MODEL_RESERVED/SUBMIT_RESERVED/UNKNOWN/ACKNOWLEDGED block subsequent pairs. Restart preserves spent records, including unfinished ones. Reconciliation only operates on settled submissions and never clears a stop flag.

Bounds: maximum 14-day config plus frozen round close; 20 unique admitted questions; 5 new questions and 5 mock inference attempts per UTC day; 24 mock inference attempts total including failures; 3 supplied synthetic source slots per question and 60 overall. One inference per admitted question means this implementation's reachable total is stricter than 24; tests inject boundary counters to exercise 24 directly. Sources are supplied fixtures, not fetched, so source counters are reserved slots, not claimed actual network measurements. The first stop/deadline/state/storage/uncertain failure blocks subsequent external-effect intent. There is no production tokenizer: actual model input budget verification remains a live gate. The 50 ms watchdog is deliberately a fast mock-test bound, not a production timeout recommendation.

## Verification

22 integration tests cover eligible→evidence→schema output→exact pair; missing/conflicting evidence abstention; closed/history/provider mismatches; duplicate/changed details; malformed model output; unknown sources and capped usage; timeout UNKNOWN/late receipt/restart; HTTP 201 acknowledgement without IDs; reconciliation gating; 20/24/60 caps and daily limits; stop/rollback/deadline; SQLite close/reopen; simultaneous duplicate calls; separate SQLite connection observing ADMITTED; final pre-effect rechecks; and exact compatible mock request shape.

Separate-connection testing uses a preseeded ADMITTED row, not comprehensive simultaneous multi-process stress. Node SQLite testing does not prove Cloudflare DO output gates or distributed durability. Tests include final deadline checks, duplicate reservation ownership, reconciliation races and ADMITTED exclusivity.

## Reused source, unchanged

The deps/ files are copies of existing separately tested modules: metaculus-eligibility-offline (gate, provider-shape, strict-json), structured-forecast-validator (validator), finite-compatible-offline (transport, provider-contract), and metaculus-atomic-contract (contract). They retain their strict boundaries. No historical source/receipt/ledger is edited. dependency-sha256.txt pins copies. The provider generation schema is intentionally less expressive than the strict local semantic validator; valid schema does not prove accurate forecasts or adequate evidence.

## Remaining live gates

Freeze an actual round ID/slug/end and protocol before any contest inspection; verify registration/primary-bot/prize eligibility; implement and verify real deterministic criteria parsing or abstain; obtain fresh authenticated own-history and detail with explicit completeness/freshness semantics; verify source retrieval and conservative pre-dispatch input accounting; design true provider/transport receipt authenticity and feasible reconciliation; port/test durable budget and atomic-pair wiring in real runtime; obtain bounded inference and publication authority. Identity access verification alone satisfies none of these publication gates. No manual-per-question tuning or blanket human approval requirement is introduced. Current competition support remains disabled.
