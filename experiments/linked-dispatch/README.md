# Linked Dispatch: offline feasibility prototype

An original, deterministic, offline puzzle study for Halifax Small Hours. Working title only; no trademark clearance or global novelty claim. This is a feasibility source snapshot, not a launched product or evidence of demand.

## Play

Open `index.html` in a modern browser, keeping `style.css`, `app.js`, `engine.js` and `levels.js` beside it. Alternatively serve this directory with an ordinary local static server. No build, package installation, account or internet connection is intended to be needed. Actual browser compatibility remains **unverified**.

“Flip one linked pair of gates; both parcels move one step. Deliver both without crashing.”

Select A, B or C to inspect the next-step preview, then press **Flip**. Selection alone does not move parcels. A flip changes two linked gates before advancing both undelivered parcels along the arrows. Own depots absorb parcels. A shared junction, head-on swap or wrong depot crashes. Undo and reset are unrestricted. All twelve boards are available from the selector.

The first three boards teach paired gates, the shared movement clock, and a conflicting choice. Nine subsequent boards have shortest solutions of 6–12 flips. These are structural measures, not human difficulty ratings. Original fixed directed layouts were deterministically generated and screened, not copied from another game. Runtime levels are fixed, not procedurally generated.

Mouse/touch controls and responsive styles are implemented but not browser-tested. Optional single-key shortcuts are off by default; enable them in “How the routes work.” With a game control focused, A/B/C selects, Enter on a preview flips, Z undoes and R resets. Standard Tab/button activation remains available without shortcuts. Parcels use distinct shapes as well as color. Full screen-reader accessibility is not established: the SVG does not provide a complete textual route adjacency view.

## Verified

- Independent Python reference versus JavaScript engine across all reachable states: 1,249 states, 3,712 valid transitions and 12,490 invalid-action checks, 16,202 comparisons total, zero mismatches.
- 35 undo/reset/history scenarios and 14 explicit rule fixtures passed.
- Removed parcels stay removed; terminal states freeze; collision and false-win fixtures pass.
- Node fake-DOM UI smoke tests completed all 12 solutions (83 flips), non-mutating previews, undo/reset on each board, crash recovery, completion-count accuracy, opt-in keyboard behavior and focus handling.
- Static JavaScript syntax checks pass. Runtime source contains no remote assets, fetch calls, SDKs, tracking, accounts, ads, audio or payment integration. CSP disallows network connections. This is source inspection, **not an observed runtime network audit**.

Run `python tests/verify_rules.py` and `node tests/ui-dom-smoke.cjs` for reproducible checks. `levels.json` includes solution traces and state counts. `generate.cjs` and `curate.cjs` document the deterministic offline selection; they are not runtime dependencies.

## Important verification limits

Actual browser rendering, mobile/touch emulation, physical devices, viewport overflow, screenshots, browser console and network-request audit are **unverified**. `browser-test.cjs` preserves the intended browser test for a suitable environment; its presence does not mean it passed.

Every main board rejects a repeated-single-button win, has a joint optimum longer than the maximum of its solo optima, and changes its winning solution set when at least one linked gate member is frozen. A stronger conflicting-choice proxy passes 8/9 main boards, not all nine: board 11 lacks an individually viable/other-doomed alternative on its shortest paths. Some physical gate members are not essential. This is enough evidence that coupling is not merely cosmetic, but not that every board is equally good.

No human playtest, retention test, monetization test, rights/platform acceptance review or revenue evidence exists. The next justified gate is actual browser QA followed by a small human comprehension/playtest, not launch, ads, accounts or additional content. Stop and simplify if humans cannot understand the shared action or find it uninteresting.

## Size and dependencies

The five runtime files total approximately 25 KB uncompressed, below the 1 MB target. No external runtime dependencies. Vector visuals are drawn from original code; no licensed assets or fonts are bundled. The browser QA script optionally uses an already installed Playwright/Chromium, and tests require Node/Python; players do not need them.
