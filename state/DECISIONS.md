# Decision log

## D001 — 2026-10-22 — Bootstrap records without activation
- Decision: preserve the charter/README; add minimal public-safe status, finance and architecture records on an isolated review branch.
- Evidence: initial main `a57d1c57de7e9868778f02533bc981faa60a8ec9`; GitHub reports public repository.
- Limits: $0 budget; no inferred revenue, account creation, credential grants, scheduled execution or external marketing.
- Revisit: after opportunity ranking and review; record the selected strategy and invalidating assumption as a new decision, not a rewritten history.

## D002 — 2026-10-22 — Keep inference separate from scheduling
- Decision: evaluate a short-lived GitHub-hosted runner with an explicitly selected external inference provider; no deployment yet.
- Rationale: documented free public-repository standard runner execution can minimize infrastructure cost, but cannot supply a model. GitHub Models is retired; do not rely on historical free inference claims.
- Provider choice: provisional shortlist only; benchmark quality and verify account-level free eligibility before choosing. See [runbook](../operations/RUNBOOK.md).
- Stop condition: any billing, credentials, rights or persistence uncertainty blocks execution rather than enabling a paid fallback.

## Pending commercial decision
No business has yet been selected in this checkpoint. Add evidence-backed ranking, primary experiment, price hypothesis, conversion criterion and abandonment threshold after research review. Forecasts must remain separate from measured outcomes.
