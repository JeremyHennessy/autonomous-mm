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

## D003 — 2026-10-22 — Select a USD 99 reproducible CSV pilot
- Decision: test a fixed-scope original-preserving CSV repair deliverable, with exception report and reusable script, rather than build an app first.
- Evidence: [initial opportunity screen](../research/opportunities/initial-screen.md) compares 11 distinct approaches; adjacent demand and pricing support testing, not a guaranteed sale. Distribution remains the weakest assumption and no current qualified buyer/free channel is established.
- Preparation: synthetic demonstration prepared; 10 unit tests and fresh byte-identical reproduction passed; [plan](../experiments/001-demand-test/PLAN.md) and [offer](../experiments/001-demand-test/OFFER-DRAFT.md) are not launched or sent.
- Gate: approved eligible channel, identity and bounded responses; separate receiver/settlement and contract/data-handling authority before accepting a job. $0 spending cap unchanged.
- Stop/review: ten eligible offers with no qualified response, or three qualified conversations without willingness to pay USD 99; if two deliveries exceed two operator hours, reduce scope or reprice.
- Success: one delivered, accepted pilot with settled receipt and attributable costs reconciled within the experiment window, subject to payout holds. Forecasts are not measured profit.
