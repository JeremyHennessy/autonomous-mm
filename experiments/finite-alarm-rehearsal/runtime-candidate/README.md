# Disabled runtime wiring candidate, separate review

Files: config.mjs, wiring.mjs, worker.mjs, wrangler.example.jsonc, test.mjs. Run `node --test runtime-candidate/test.mjs` from parent directory. Four offline test groups pass.

config.mjs has both routing and window disabled. No environment flag, request body, query or header can activate it. Wrangler’s main deliberately does not exist. The checked-in defaults cannot activate uploads, timers or provider calls.

worker.mjs supplies the official DurableObject base; wiring.mjs accepts an injected base/storage/AI for local tests and delegates directly to the frozen core. ctx.blockConcurrencyWhile awaits startup. SQLite sql.exec/transactionSync/sync and getAlarm/setAlarm/deleteAlarm are provided by ctx.storage, not recreated. Only status/start RPC methods and the system alarm callback are defined. One fixed object name, POST /start with bounded empty-stream validation, and GET /status. No generic RPC dispatcher, stop/reset/rearm endpoint, credentials or cron.

The GET handler invokes status only, never start, inference or scheduling. Startup initialization/recovery belongs to the existing core and can write recovery state/delete an alarm; core status also performs defensive cleanup on a storage error. Therefore GET is read-only in intent and ordinary operation, not a promise of zero incidental lifecycle writes. This is an explicit core-review dependency rather than hidden extra behavior.

This candidate does not solve external route cleanup. An independent connector observer must close/verify workers.dev and preview routes. No account-management binding is supplied. Default alarm handler does nothing while disabled; this candidate must never be applied over an existing armed deployment as a substitute for approved alarm cleanup.

Read-only current documentation:
- https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/ documents SQLite storage, transactionSync, sync and alarm APIs.
- https://developers.cloudflare.com/durable-objects/api/alarms/ documents alarm callback and at-least-once delivery.

No Cloudflare runtime integration test was executed. Node tests verify the injected wiring and actual core behavior with SQLite/fake alarms, not platform dispatch, hidden lifecycle timing or deployment compatibility. Independent core review remains a prerequisite; any findings must be resolved before activation.
