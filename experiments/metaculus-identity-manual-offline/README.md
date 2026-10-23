# Disabled identity diagnostic candidate

OFFLINE ONLY. No activated route, cron, live request, credential default or deployed configuration. The separate runtime/ directory contains a disabled reviewed wrapper. Historical failed snapshots remain unchanged. The public example uses fictional expected identity values and does not establish live identity or token validity.

Run `node --test *test.mjs runtime/test.mjs` with Node's built-in SQLite module. No dependencies or installs. Tests are synthetic and self-contained. Local SQLite verifies SQL and transactions, not Cloudflare output-gate/storage failure semantics.

## Diagnostic contract

`runner.mjs` receives a reviewed injected transport, credential getter, clock, timer and durable persistence functions. Defaults disabled before reading dependencies. Fixed GET /api/users/me/, token only in authorization header, no Cookie header or browser cookie jar, redirect manual (every 3xx rejected), no-store. Bound: five-minute immutable window, one consumed reservation, five-second watchdog, 16,384 body bytes, 32 chunks. Never retry, reset or rearm.

Durable checkpoints record stage/timestamps, dispatchAttempted, dispatchMayHaveOccurred, fetchResolved, validated HTTP status, content-type category (json/html/absent/other), error-name whitelist, byte/chunk counts and body/parse/shape classifications. No raw errors, messages, stack traces, profile fields, response headers, URLs from responses or credentials are retained. Match compares only the fixed fictional identity fields. No public result endpoint.

`dispatchMayHaveOccurred=true` is persisted before invocation, then the clock is checked immediately before invocation with no intervening await. A crash in this gap is inherently ambiguous: the durable false dispatchAttempted field is NOT proof no dispatch occurred. A successful persisted terminal observation can distinguish sync throw, promise rejection, timeout and extraction/read/parse/shape failures. If persistence fails, report storage-unverified and retain the consumed claim; missing diagnostics never authorize retry. Post-timeout work cannot overwrite terminal storage. Terminal verified results crossing expiry during sync are downgraded uncertain.

`ledger.mjs` is an unactivated SQLite adapter using transactionSync and sync. Never point it at the old consumed record. runtime/wiring.mjs awaits initialization in blockConcurrencyWhile. Durable object identity, source/config binding, cleanup and private result retrieval require integration review before any future authorization request. This candidate does not install or remove any trigger.

## Evidence, not diagnosis

Cloudflare documents `cache:'no-store'` as supported: https://developers.cloudflare.com/workers/runtime-apis/fetch/ . It is not an established fault in the old request.

Cloudflare describes lost receiver errors for runtime methods generally: https://developers.cloudflare.com/workers/observability/errors/#illegal-invocation-errors . This does not establish that bare global fetch failed here. The wrapper preserves global receiver with `(url, init) => globalThis.fetch(url, init)`; the receiver-sensitive synthetic test only proves the wrapper pattern, not the old runtime cause.

The historical redirect:error request is incompatible with workerd. This separate candidate uses manual and stops on every 3xx without reading Location. A generic TypeError alone still does not identify authentication, DNS or TLS failures. A received 3xx/redirected flag is separately classified. HTTP status is read from the actual resolved response, never stale binding state. Storage/watchdog failure may still leave partial diagnostics. No additional live attempt is justified merely by this repair.
