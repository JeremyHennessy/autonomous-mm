# Finite synthetic alarm rehearsal: OFFLINE, NOT ACTIVATED

Run `node --test test.mjs`. The Worker shell always returns 503; it exposes no RPC or alarm handler. WINDOW is disabled with zero timestamps. There is no deployable config, route, credentials, timer installation or provider client. Injected interfaces in tests are synthetic only. Do not activate without separate approval and independent review.

## Frozen intended protocol

One fresh SQLite object; exactly three fixed fictional fixtures in core.mjs: fair coin probability 0.5, evidence-free abstention, contradictory-evidence abstention. One manual start, then at most two setAlarm scheduling reservations at fixed start + 2 minutes and start + 4 minutes. Each fixture gets one durable reservation before inference. All calls use named Llama 3.3, JSON Schema messages, stream: false, max_tokens: 512; the local validator’s bounds are explicitly 512 output tokens and 24,000 input tokens. Exactly three attempts maximum, no retries/reset/rearm; no real question or publication path.

Any provider, schema, expectation, clock, storage, scheduling or restart uncertainty stops the run. Model-call watchdog is 60 seconds; no new dispatch in the final minute of the 20-minute window. Late results are rejected; an already-started provider operation cannot be guaranteed cancelled. At-least-once alarms cannot duplicate a reserved fixture. Early/duplicate delivery before the next due slot stops rather than advancing. Terminal paths request deleteAlarm, but persisted terminal state remains the safety authority. Uncertain/missing scheduled alarm on restart stops rather than repairing scheduling.

The safe status contains fixture index, state, fixed reason, validated numeric usage, timestamps, and alarm-presence boolean only. No rationale/provider output, request text, error strings or private state are exposed. Reserved bounds are ledger fields, not actual measured usage. The validator uses explicit input/output bounds for this synthetic protocol.

## Full-context conservative budget, read-only docs checked 2026-10-23

The exact model page lists a 24,000-token context window:
https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/

Reserve the entire documented context as input for EACH call, plus 512 output tokens separately. This deliberately over-reserves if the context includes output. It relies on the documented model ceiling; it is not a tokenizer result, proof every submitted request fits, or actual measured use. A rejected oversized request consumes its attempt and stops the test. This scope uses fixed short fictional inputs only and does not relax the forecasting pilot’s separate 8,000 input gate.

Pricing lists 26,668 neurons/million input tokens and 204,805 neurons/million output tokens for the exact model. Per call: (24,000 × 26,668 / 1,000,000) + (512 × 204,805 / 1,000,000) = 744.89216 neurons, conservatively rounded to 745; three calls reserve 2,235 neurons. Workers AI Free allocation is 10,000 neurons/day shared by the account; this reservation is below the full allocation, NOT a measurement of remaining quota. This calculation is not independently verified account entitlement or a $0 invoice guarantee. Quota errors stop, never upgrade/fallback.
https://developers.cloudflare.com/workers-ai/platform/pricing/

Free supports SQLite DOs; alarm invocation counts as a request and setAlarm as a row write. Free-limit excess fails operations. DO/Worker resource usage is separate from AI-neuron accounting; remaining account quota is not established by this prototype.
https://developers.cloudflare.com/durable-objects/platform/pricing/

Alarms are at-least-once; throwing can cause automatic retries. deleteAlarm during a handler is best-effort against retries. Reservation/state checks therefore provide safety, not deletion alone. No constructor schedules alarms.
https://developers.cloudflare.com/durable-objects/api/alarms/

## Remaining activation gates

1. Independent review of this offline implementation and adverse interleavings, including exact deployed Durable Object storage/sync/setAlarm behavior. Node SQLite/mocks do not prove Cloudflare runtime semantics.
2. Separate explicit approval for one isolated deployment, up to 3 calls with 512 output tokens each, two finite alarms, temporary public start/status URL and 20-minute window. No perpetual cron.
3. Freeze actual future timestamps and exact source/config identity, implement and review the minimal DO/HTTP wiring with empty-body-only start, and verify no extra bindings/secrets/schedules. Current shell cannot run it.
4. An external connector observer must inspect terminal status/alarm absence and disable/readback public+preview routes by expiry. Worker must not receive account-management credentials. Route shutdown does not cancel alarms. No exact route-cleanup automation is implemented here.
5. Resolve any runtime JSON Mode/schema/usage representation mismatch by stopping, never parsing prose or retrying. Valid schema is not evidence of forecast skill or sufficient real-world evidence.

This source snapshot is disabled and does not itself authorize a live timer, model call, deployment or account change.
