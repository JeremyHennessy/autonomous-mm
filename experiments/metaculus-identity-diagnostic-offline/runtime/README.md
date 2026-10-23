# Disabled Cloudflare identity diagnostic example

Offline example only. Run `node --test *test.mjs runtime/test.mjs` from the parent directory. The 28 core/SQLite tests and eight wrapper tests use synthetic responses and local SQLite, not a Cloudflare runtime emulator. The expected identity is fictional. No live calls, credential setup or deployment are performed by this snapshot.

## Structure and disabled defaults

The main module is `runtime/worker.mjs`; it imports `runtime/wiring.mjs`, `runtime/config.mjs`, `runner.mjs` and `ledger.mjs`. `runtime/cleanup.mjs` is an inert restoration example. The configuration is disabled with zero start and expiry values. Example metadata contains no account or namespace identifiers. Binding and object names are illustrative, not an existing deployment inventory.

The wrapper uses DurableObject inheritance, awaited blockConcurrencyWhile initialization, SQLite transactionSync followed by sync, a fixed-name getByName RPC and receiver-preserving globalThis.fetch. Every HTTP method returns 503 without reading environment bindings. There is no HTTP status/control endpoint or alarm handler. The disabled scheduled handler makes no request. If separately configured and approved, the core would require a consumed reservation before reading the illustrative METACULUS_TOKEN binding and permit only one bounded identity request.

The RPC returns state only; detailed diagnostics require separately authorized private storage readback. No raw profile, credential, response headers or error text is persisted. IdentityCheck is an inert example legacy class; cleanup preserves both exported classes without invoking their storage.

## Unverified integration and activation gates

The runtime wrapper is tested offline, not verified in Cloudflare. Platform propagation, output gates, RPC serialization and actual fetch behavior remain unverified. The earlier uncertain live attempt remains unexplained; this source does not repair its missing evidence or authorize retry.

Any future deployment requires separate review and exact approval, verified binding and migration inventory, a fresh one-use guard, a frozen five-minute window, private routes, exact source readback and explicit cleanup. Do not overwrite or reset consumed records. Scheduled expressions may recur unless removed; operator cleanup must remove triggers and restore inert code while retaining evidence. The Worker has no management credential to remove its own schedule. A missed window, absent result or storage uncertainty never authorizes retry. Example upload metadata is not a deployment instruction or migration plan.

## Official references reviewed 2026-10-23

- Initialization: https://developers.cloudflare.com/durable-objects/api/state/#blockconcurrencywhile
- SQLite transactions and sync: https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/
- Fixed-name RPC: https://developers.cloudflare.com/durable-objects/api/namespace/#getbyname
- Scheduled handlers: https://developers.cloudflare.com/workers/runtime-apis/handlers/scheduled/
- Fetch and no-store: https://developers.cloudflare.com/workers/runtime-apis/fetch/
- Upload metadata: https://developers.cloudflare.com/workers/configuration/multipart-upload-metadata/
