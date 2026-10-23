# Instrumented finite runner: separate OFFLINE repair

Run `node --test test.mjs`. Nineteen test groups pass. WINDOW remains disabled, and worker.mjs always returns 503. No deployment config, routes, live alarms, credentials or provider calls are enabled. This is a separate prototype and does not modify prior experiments.

## What changed

The offline runner commits and flushes bounded stage/timestamp observations for request-build, binding-read, dispatch-invocation, await-provider, provider-resolved, usage-extracted, status-extracted and validator. Exceptions identify synchronous invocation failure, rejected await, watchdog timeout, usage-read failure or ancillary status-read failure separately. The existing reserve-before-call and permanent stop/no-retry rules remain.

Dispatch-attempted is persisted immediately BEFORE invocation, so it means invocation may have happened if interrupted, not proof the provider executed. Provider-resolved is recorded only after the awaited call returns. If persisting a later observation fails, the previously durable reservation remains consumed, the controller stops and cleanup is attempted. A storage outage can prevent persisting the latest diagnostic; do not fabricate confirmation.

No binding status field is assigned/reset. Frozen and getter-only fake bindings therefore no longer fail merely from status assignment. Numeric status snapshots are advisory observations of binding fields, not guaranteed fresh per-call receipts: without a separately verified request correlation, unchanged fields may be stale. Provider-resolved and stage evidence must not be inferred from HTTP 200 alone.

Valid numeric usage is copied and persisted BEFORE status getter access. A post-success throwing status getter stops the run but does not discard confirmed resolution or valid usage. Retained usage can include cap-reaching output for diagnosis even though the exact validator rejects it. Raw provider output, rationale, errors, message/stack, arbitrary environment objects and request IDs are not retained.

The watchdog uses a private symbol sentinel rather than matching raw error strings. Default timeout remains 60 seconds; tests inject only the wait boundary, not a live provider. Late provider settlement cannot resume the stopped run. Initial failure consumes its fixture and prevents subsequent scheduling; terminal cleanup attempts deleteAlarm, with ledger state remaining authoritative.

## Regression evidence

Tests exercise real runner paths with frozen/read-only status fields, post-success throwing getter, synchronous throw, rejected promise, watchdog timeout, pre-dispatch getter failure, stage-flush failure, concurrent invocation, restart, duplicate alarms, cap/expectation failure and the complete three-fixture synthetic sequence. All mocks and receipts are offline evidence only.

## Exact lesson and limitations

finite-v1 collapsed several distinct failures into stopped/provider. These fakes prove diagnostic ambiguity, not its actual cause. Status assignment existed in successful earlier smoke calls; removing it here does not diagnose the production failure. The old discarded exception cannot be recovered from this repair.

This is a separate version 2 ledger identity/table and must never be used to reset or rearm an old consumed record. No runtime wiring is supplied. Source schema support, Cloudflare event ordering, billing usage, actual provider failure and real forecasting adequacy remain unresolved. Diagnostics helpers inspect only source-verified binding numeric fields; current official workerd source is not proof of the precise deployed build. Independent review is required before any future integration, and separate activation approval would still be required. No automatic live test is authorized.

References (previously verified read-only):
- https://raw.githubusercontent.com/cloudflare/workerd/main/src/cloudflare/internal/ai-api.ts
- https://developers.cloudflare.com/workers-ai/platform/errors/
- https://developers.cloudflare.com/durable-objects/api/alarms/

Final-dispatch timing correction: the authoritative clock is rechecked after the last pre-dispatch diagnostic flush, with no await between the check and run.call. Reaching the 20-minute expiry or final-minute cutoff, rolling backward or returning an invalid clock records not-dispatched, clears dispatchAttempted when that observation is durably saved, and permanently stops while preserving the spent reservation. A failed diagnostic write still leaves conservative uncertainty and never authorizes retry. Regression tests advance the clock during the dispatch marker flush and prove zero calls.

A dedicated stale-code regression rejects a call while the binding still exposes HTTP 200. The runner remains stopped/await-rejected, providerResolved:false, with no validated usage and no retry. The numeric 200 is only an observed binding value, not the failing request’s proven status.
