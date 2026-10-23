# Platform-specific offline regression

Official registry package workerd@1.20261023.1, installed with --ignore-scripts --no-audit --no-fund; binary provided by @cloudflare/workerd-linux-64. No new provider credential or deployment.

Run the installed workerd binary with `test workerd-test/config.capnp` from the candidate root. No sockets, external servers or network service are configured. Global fetch goes to an in-process fictional fixture; the explicitly named internet service is itself a Worker that throws and never forwards. No request leaves the process.

One real workerd test handler proves seven acceptance assertions:
1. Historical Request init with redirect:error throws TypeError during construction.
2. Historical global fetch returns a promise that rejects TypeError, matching the actual diagnostic stage/class (without proving the old private error message).
3. Manual Request construction works with the other chosen options.
4. Manual fetch reaches the local fixture and receives 200.
5. Manual redirect yields 302 without following Location.
6. credentials:omit is ignored by this pinned runtime; the corrected candidate omits it rather than relying on browser behavior.
7. Corrected full runner dispatches once and persists verified/HTTP200 against the synthetic local fixture. The public fixture uses fictional identity values.

Remaining RequestInit: GET with no body, fixed Authorization/Accept header values, cache:no-store, AbortSignal. All exercised here. No Cookie header or browser cookie store is used. No mode/referrer/integrity settings. This local test cannot prove upstream connectivity, production profile shape, token validity, production runtime build equivalence or billing.

Source evidence:
- https://developers.cloudflare.com/workers/runtime-apis/request/ documents unsupported redirect:error and manual status handling; cookies are ordinary headers, not a managed browser cookie jar.
- https://developers.cloudflare.com/workers/runtime-apis/fetch/ documents no-store.
- https://github.com/cloudflare/workerd/blob/main/src/workerd/api/http.c%2B%2B tryParseRedirect accepts follow/manual only.
- https://github.com/cloudflare/workerd/blob/main/src/workerd/api/http.h omits browser-only credentials/mode from RequestInitializerDict.

The previously deployed code/receipts remain unchanged. This separate disabled fix stops on every 3xx, never reads Location and never follows even a same-origin redirect. A platform-specific regression was missing from earlier Node-only verification; repeated diagnostic cloud attempts were avoidable. No further live request is authorized by these tests.
