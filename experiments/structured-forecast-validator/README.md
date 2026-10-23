# Pure structured-forecast validator: synthetic only

Run: `node --test test.mjs`. Twelve test groups pass without dependencies, network calls, environment reads, persistence, adapters or publication code. This is offline source, not integrated or deployed code.

`requestFixture` returns a request description only. It uses the named Llama3.3 model, system/user messages, stream:false, max_tokens:2000, and response_format:{type:'json_schema',json_schema:<schema directly>}. There is no raw:true or simultaneous prompt. Messages are not a guarantee of behavioral compliance.

`validateForecast` accepts only a direct object-valued response with complete internally consistent integer token usage, successful provider transport metadata, output below the cap, and no error/alternate envelope. A supplied finish reason must be stop; length and unknown/null reasons fail. Missing finish reason is allowed because the documented binding output does not promise one; usage below the cap is still mandatory, not proof of a complete response. Missing usage, tool calls, unknown keys, malformed IDs, numeric strings, nonfinite probabilities, unlisted/duplicate sources and unbounded rationales are rejected. It never parses strings, prose or partial JSON. Return values are detached copies; denials carry fixed reasons only.

The minimal payload pins schema_version and synthetic question_id. Forecast probability is numeric in [0,1], with at least one supplied source ID; abstention requires null probability. Rationale is nonblank and at most1000 JavaScript code units/4000UTF8bytes. JSON schema maxLength semantics and the stricter local code-unit check are not treated as interchangeable. Allowed source IDs only establish membership in a supplied bundle, not correctness, independence, quality or adequacy of evidence. A valid schema does NOT prove a correct forecast or justify publication.

## Documentation verified read-only, 2026-10-23

- https://developers.cloudflare.com/workers-ai/features/json-mode/ : direct json_schema example and object-valued response example; the page warns JSON Mode does not guarantee schema adherence.
- https://developers.cloudflare.com/workers-ai/models/llama-3.3-70b-instruct-fp8-fast/ : named model request options, messages, response_format and non-stream usage schema.

These are documentation observations, not a runtime test of JSON Mode, anyOf support, usage fields or model compliance. The request schema is reviewed locally by construction/tests, not by a general JSON Schema engine. Endpoint representation differences require separate review, not silent coercion. The pure validator does not provide exact input tokenization, whole-request overhead bounds, runtime quotas, eligibility, forecasting accuracy, transport authentication or publication authority. Synthetic restrictions intentionally prevent treating this artifact as live question support.

All fixtures are synthetic. This module has no inference, deployment, credential, timer, route or billing functionality. Future runtime/schema verification requires separate scoped authorization.

Representation caveat: the model page’s generic output reference labels response as a string, while the JSON Mode feature example explicitly shows an object. This artifact deliberately follows only the latter object representation and fails closed on a string. That documented inconsistency is unresolved by a live test here.

## JavaScript boundary hardening

Non-JSON object edge cases are rejected: required fields must be enumerable own data properties, and usage values are checked and returned explicitly. Source/context/tool arrays must have the standard array prototype, dense enumerable own elements and no custom keys, symbols or accessors. Elements are copied through descriptors once, then the same bounded copy is validated and returned. Synthetic adversarial regression tests cover these boundaries; they do not represent observed provider attacks or actual provider responses. This validator is not a security sandbox for arbitrary executable JavaScript or hostile proxies.
