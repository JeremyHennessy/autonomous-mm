# Compatible finite-v2 result — 2026-10-23

## Verified outcome
All three fictional fixtures passed in an actual Cloudflare Worker using its AI binding and SQLite persistence: fair-coin probability 0.5, evidence-free abstention and contradictory-evidence abstention. One manual POST initiated the first fixture; automatic alarms ran the remaining fixtures at 02:16 and 02:18 UTC. Terminal status at 02:18:04 UTC was complete with alarmPresent: false.

Deployed source was read back exactly. Verification included 31 offline synthetic tests and two private receipt checks; private checks and receipts are not included in this public snapshot. Public and preview routes were verified off by the executing agent at 02:18:16 UTC and independently at 02:18:36 UTC. No retries, real competition forecasts, new keys or paid changes were made.

## Usage and limits
Reported token usage totalled 360 input + 246 output = 606 tokens. Using [published model rates](https://developers.cloudflare.com/workers-ai/platform/pricing/), the estimated neuron use is (360 × 26,668 + 246 × 204,805) / 1,000,000 = 59.98251. This is a rate-based estimate, not provider-reported neuron usage or an invoice; billing totals remain unreconciled.

This verifies bounded scheduled AI execution with durable results for three synthetic cases. It does not verify always-on operation, real forecasting accuracy, a competitive edge, customer revenue or profit. No future run is scheduled. The [checked-in candidate](README.md) retains disabled defaults; this result does not authorize activation or reset consumed records.

Earlier diagnostic failures and finite-v1 uncertainty remain preserved in [STATUS](../../state/STATUS.md) and Git history. This later success does not recover their discarded diagnostic information or prove their cause. Account/namespace identifiers, private paths and raw receipts are excluded.
