# Cloud reasoning architecture and activation gates

Research checked 2026-10-22 UTC. **Design only: no workflow, provider, model call, credential, hosting deployment or recurring schedule has been configured or tested here.**

## Minimum architecture
Proposed future chain: explicit manual cloud trigger → short-lived standard GitHub-hosted runner → deterministic preflight/authorization guard → one external model request over HTTPS → strict output validation → durable public-safe checkpoint → separately verified completion record. Later, an approved schedule could trigger that same bounded job. Scheduling is not inference, and a model response is not permission to act.

Use GitHub as the operational system of record, not as the model. Do not depend on the user's computer or a continuously open chat. Default capabilities are reading allowlisted public sources and proposing a next action; no arbitrary shell execution, purchases, outreach, account changes or recursive agents from model output.

## Provider comparison (official sources, not account verification)

| Option | Current documented economics / caveat | Bootstrap assessment |
|---|---|---|
| Groq API free plan | Published organization-level request/token rate limits vary by model; account limits are authoritative. Free-plan availability is documented, but no account entitlement is verified here. | Candidate for one bounded text/structured-output test. Select an available non-preview model only after live quota and terms check. No Developer-plan upgrade. |
| Google Gemini Developer API | Pricing lists free input/output for `gemini-2.5-flash-lite`; free-tier content can be used to improve products. Paid standard text rates listed are $0.10/M input and $0.40/M output tokens. | Candidate for public, non-sensitive research only; actual region, model availability and free quota require verification. Never enable paid billing to fix quota. |
| Cloudflare Workers AI | Free allocation: 10,000 neurons/day; excess needs Workers Paid, where overage is $0.011/1,000 neurons. Some models require a paid method. | Candidate if an approved account can use a free-eligible model. REST inference avoids deploying a Worker for the first test. Never select paid-only models or prepaid credits. |
| GitHub Models | Official notice says fully retired July 30, 2026, including inference API and BYOK. | Excluded. GitHub Copilot access is not assumed to be a general API entitlement. |

Sources: [Groq limits](https://console.groq.com/docs/rate-limits), [Groq billing](https://console.groq.com/docs/billing-faqs), [Gemini pricing](https://ai.google.dev/gemini-api/docs/pricing), [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/), [GitHub Models retirement](https://docs.github.com/en/github-models).

These are shortlist findings, not a comprehensive market survey or a model-quality benchmark. An OpenAI subscription/API credit is neither required nor presumed. Cloudflare account access and Workers account settings were checked read-only; the returned standard usage model does not establish free-only billing. The subscription read was denied (HTTP 403: connected OAuth has no Billing endpoint scope); no retry or access expansion was attempted. No balance or inference entitlement is verified. Provider selection remains conditional on the zero-dollar gate and test quality.

## Alternative without a standalone inference key
A future Cloudflare Worker with a [Workers AI binding](https://developers.cloudflare.com/workers-ai/configuration/bindings/) can call `env.AI.run()` without embedding a separate inference API key. A later cron trigger could start it. This avoids one secret, not billing verification, deployment/access review, durable state design or scheduler tests. Binding access and GitHub write credentials must be evaluated at their exact scope before deployment. No such Worker exists for this initiative.

## Cost envelope
Design target: one request, at most 4,000 input tokens and 1,000 total generated tokens (including any reasoning tokens), one attempt, no tools/grounding/cache charges, and maximum five-minute cloud job. Enforce provider-specific total-token semantics, not just visible-answer tokens. If a provider cannot bound generation, do not use it.

Hypothetical paid Gemini Flash-Lite token arithmetic at the published standard rates: 4,000 × $0.10/M + 1,000 × $0.40/M = $0.0008/request. This is an estimate, not a charge, authorization, or full workload cost. Under the current $0 cap even this paid request is prohibited. An eligible free-only request might cost $0, but verify the account and lack of paid fallback before running.

[GitHub billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions) documents standard hosted runners as free in public repositories; larger runners and storage can have separate charges. Choose standard Linux only, no cache or artifact upload, and verify current billing eligibility. Commercial autonomous workloads must also satisfy GitHub's current acceptable-use terms; the free runner is not a general hosting entitlement. If the intended workload is ineligible, stop and select a separately authorized runtime instead.

## Gates and proof requirements
1. **Design review (prepared):** the requested read-only design/research is authorized. Before execution, resolve the exact provider/model, data sent, one-request limits and public checkpoint destination within that authority. Verify service terms, geographic eligibility, model license and current pricing.
2. **Access/billing (not passed):** confirm free-only plan with no billable fallback. Obtain action-appropriate approval before creating/configuring persistent credentials. Store secrets only in an approved secret store, never in git or logs. Existing connector access is not API-runtime authorization.
3. **Implementation (not started):** manual trigger only, pinned dependencies/actions, minimal `contents: read` inference job, five-minute timeout, fixed concurrency group, no auto-retry, bounded input/output, strict JSON schema, endpoint/model allowlist and fail-closed gates. No `schedule`, push or untrusted-PR inference triggers.
4. **Durability test (not run):** separate deterministic writer gets only explicitly approved repository permissions. Write a validated, redacted result to a dedicated run branch using compare-and-swap on the expected parent. No force-push, main write or model-directed path. Parent/reviewer can then open a checkpoint PR. Test that a fresh job reads that checkpoint without chat context. If repository policy forbids the write, stop rather than creating a broader token.
5. **Recovery/stop test (not run):** demonstrate duplicate run rejection, interruption before/after checkpoint, invalid JSON, timeout, 429, missing credentials, exhausted free quota and a disabled stop flag. Preserve last-good checkpoint; record failure without labeling it successful. Unknown request outcome must not auto-retry.
6. **Recurrence (blocked):** only after the manual cloud run and recovery tests pass, verify the bounded schedule/task fits existing authority and obtain any missing approval for new access or notification destinations. Verify actual scheduled run/job IDs and checkpoints, not just YAML syntax. No continuous-operation claim before this evidence exists.

## Checkpoint contract
Record run ID, input commit, task ID, UTC start/finish, provider/model ID, actual token usage (or explicitly unavailable), estimated/verified charge with evidence state, result status, prior checkpoint SHA, result SHA, allowed next action and last-success/next-planned timestamps. Results contain public-safe summaries and source URLs only. Sanitize model output as untrusted data; its URLs and instructions cannot alter permissions or the charter.

A deterministic idempotency key combines task ID and input commit. Already-successful keys are not executed again. Concurrent writes must fail safely rather than overwrite newer state. A separate failure record must never replace last-success. Read back the remote commit from a fresh context to establish durability. An artifact alone with expiry is not the permanent checkpoint.

## Human kill switch and failure visibility
Future default stop control: an explicitly approved runtime flag with default `disabled`; require both enabled flag and reviewed config digest before inference and again before checkpoint publication. Owner can disable the workflow and cancel active jobs; removing/revoking the provider credential is an emergency backstop. A stop cannot undo a request already sent. Measure this race in testing.

When the flag is missing, pricing/entitlement changes, budget is unknown, state is stale/conflicting, or an unauthorized action is proposed: fail closed, perform no further inference, and emit a redacted failure status. Owner-facing notifications require an approved destination; until then use the workflow conclusion/summary and repository checkpoint only. No unsolicited external alert integrations.

[GitHub schedule documentation](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule) warns jobs can be delayed or dropped and scheduled workflows run from the default branch. Record expected next run and observed last success; missed executions are failures to investigate, not evidence of 24/7 uptime.

## Rollback and current evidence
This change adds documentation only. Revert its documentation commit to roll back; it creates no services to tear down. No runtime test has passed. Manual source review and repository/document consistency checks establish only the quality of this plan, not cloud operation.
