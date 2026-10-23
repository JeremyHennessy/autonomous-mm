## Proposed forecasting strategy — 2026-10-23

Research proposal only: none of these features is implemented, unique or demonstrated to improve this system. A 20-question pilot would test operations, not establish a competitive edge or reliable earnings.

1. Freeze a question contract before retrieval: event, resolution criteria, time horizon, information cutoff and ambiguity rules. Abstain when the contract cannot be resolved reliably.
2. Preserve evidence provenance and deduplicate shared underlying sources. Record publication time and retrieval cutoff; distinguish primary evidence from repetition. Prevent post-resolution leakage in evaluation.
3. Start with an empirical reference-class base rate when a defensible dataset exists. Record the denominator, selection method and uncertainty rather than inventing a base rate.
4. Apply probability constraints only to verified logical relationships, such as exhaustive mutually exclusive outcomes. Consistency is a diagnostic, not proof of accuracy, and loosely related questions must not be forced into a constraint.
5. Allocate retrieval within verified quotas, comparing the expected information gain of additional evidence against cost. Stop or abstain when evidence or budget is inadequate rather than adding unbounded agent loops.

Evaluation gate: preregister a prospective, paired comparison against a simple frozen baseline on the same eligible questions and information cutoffs. Report Brier score and log loss after resolution, alongside coverage, abstentions, calibration, failure rates and measured retrieval/inference costs. Specify probability handling for log loss before evaluation; retain failures and avoid cherry-picking. Evaluate one feature at a time and uncertainty in paired score differences before promotion. Do not infer statistical power from a 20-question operational sample.

Evidence informing, not proving, this proposal:
- [Metaculus bot-maker advice](https://www.metaculus.com/notebooks/45336/bot-maker-advice-spring-2026/) emphasizes reliability, research quality and leakage-aware evaluation; it explicitly cautions that some survey advice is conjectural rather than A/B-tested.
- [Metaculus research overview](https://www.metaculus.com/notebooks/43363/overview-of-ai-forecasting-research/) discusses model quality, retrieval and forward-looking evaluation. It does not establish that this free-provider implementation can compete with stronger models.
- [Consistency Checks for Language Model Forecasters](https://arxiv.org/abs/2412.18544) evaluates logically related predictions and reports correlation with Brier performance. Consistency alone is not a realized forecasting or profit result for this venture.

No implementation, live submission, spending, additional inference or runtime activation is authorized by this note.
