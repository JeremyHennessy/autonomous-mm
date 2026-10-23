# Linked Dispatch: offline feasibility prototype

An original, deterministic, offline puzzle study for Halifax Small Hours. Working title only; no trademark clearance or global novelty claim. This is an early feasibility prototype offered for a bounded free feedback test, not a finished commercial product or evidence of demand.

## Seven-day free feedback test

[Play the prototype on itch.io](https://autonomous-mm.itch.io/linked-dispatch).

The project was verified as public in the publisher UI on 2026-10-23 at approximately 19:14 UTC. The corrected hosted game loaded and board one was completed. Signed-out/anonymous access was not independently verified, so this is not a claim of an anonymous HTTP pass or guaranteed distribution.

The experiment is free with no payments or donations. Platform comments are enabled for optional feedback, and the page discloses the AI-led development workflow. No external analytics or in-game accounts were added. The planned test closes on 2026-10-30 at approximately 19:14 UTC. No player demand, retention, income or commercial acceptance is established by publishing it.

The final package changes only two visible labels from the browser-tested source: “private prototype” becomes “prototype,” and “PRIVATE STUDY 01” becomes “PROTOTYPE 01.” The other four runtime files are unchanged. The complete browser matrix below applies to the preceding wording; the final hosted check covered loading and board one, not a fresh complete matrix.

## Play

Open `index.html` in a modern browser, keeping `style.css`, `app.js`, `engine.js` and `levels.js` beside it. Alternatively serve this directory with an ordinary local static server. No build, package installation, account or internet connection is intended to be needed. Browser checks below cover one Chromium environment, not broad browser compatibility.

“Flip one linked pair of gates; both parcels move one step. Deliver both without crashing.”

Select A, B or C to inspect the next-step preview, then press **Flip**. Selection alone does not move parcels. A flip changes two linked gates before advancing both undelivered parcels along the arrows. Own depots absorb parcels. A shared junction, head-on swap or wrong depot crashes. Undo and reset are unrestricted. All twelve boards are available from the selector.

The first three boards teach paired gates, the shared movement clock, and a conflicting choice. Nine subsequent boards have shortest solutions of 6–12 flips. These are structural measures, not human difficulty ratings. Original fixed directed layouts were deterministically generated and screened, not copied from another game. Runtime levels are fixed, not procedurally generated.

Mouse controls and responsive layout were browser-tested at the desktop viewports listed below; touch and physical mobile devices remain unverified. Optional single-key shortcuts are off by default; enable them in “How the routes work.” With a game control focused, A/B/C selects, Enter on a preview flips, Z undoes and R resets. Standard Tab/button activation remains available without shortcuts. Parcels use distinct shapes as well as color. Full screen-reader accessibility is not established: the SVG does not provide a complete textual route adjacency view.

## Verified

- Independent Python reference versus JavaScript engine across all reachable states: 1,249 states, 3,712 valid transitions and 12,490 invalid-action checks, 16,202 comparisons total, zero mismatches.
- 35 undo/reset/history scenarios and 14 explicit rule fixtures passed.
- Removed parcels stay removed; terminal states freeze; collision and false-win fixtures pass.
- Node fake-DOM UI smoke tests completed all 12 solutions (83 flips), non-mutating previews, undo/reset on each board, crash recovery, completion-count accuracy, opt-in keyboard behavior and focus handling.
- Static JavaScript syntax checks pass. Runtime source contains no remote assets, fetch calls, SDKs, tracking, accounts, ads, audio or payment integration. CSP disallows network connections. This is source inspection, **not an observed runtime network audit**.

Run `python tests/verify_rules.py` and `node tests/ui-dom-smoke.cjs` for reproducible checks. `levels.json` includes solution traces and state counts. `generate.cjs` and `curate.cjs` document the deterministic offline selection; they are not runtime dependencies.

## Narrow-control revision and browser checks (2026-10-23)

Only `index.html` and `style.css` changed among runtime files from the preceding source snapshot; this README updates the verification summary. The game engine, application logic, levels and test harnesses are unchanged. At widths up to 750 px, the linked-pair choices and Flip button sit together immediately below the board and undo/reset controls, with the detailed preview beneath. Controls remain in normal document flow without a fixed or sticky overlay. Original labels, handlers and keyboard behavior are retained.

Observed in one Chromium browser environment:
- All 12 solution paths completed at both 500 × 757 and 1180 × 757 desktop viewports: 83 solution flips each, 166 total.
- Previews did not mutate game state; undo/reset passed on every board; terminal win controls behaved correctly.
- No horizontal overflow or board/control overlap was observed at those sizes.
- A separate eight-move board-six playthrough using native mouse clicks kept the full board and controls visible at the narrow viewport, with scroll position unchanged at 134 px after initial positioning. Locator-driven clicks can auto-scroll and are not evidence for this usability check.
- Native Tab order from Reset through A, B, C and Flip was confirmed.
- One browser renderer crash interrupted the desktop run. A normal visible Reload recovered it, and the remaining six boards passed. The cause is not established; this is not a claim of crash-free compatibility.

These are engineering checks, not human comprehension, enjoyment or engagement results.

## Important verification limits

Viewports below 500 px, touch/mobile emulation, physical devices, other browsers, a complete console audit, a full runtime network-request audit and full accessibility remain **unverified**. The available console inspection was limited and does not establish a clean console. `browser-test.cjs` preserves a separate intended Playwright test matrix; it was not the harness used for the observed browser checks above and is not claimed to have passed.

Every main board rejects a repeated-single-button win, has a joint optimum longer than the maximum of its solo optima, and changes its winning solution set when at least one linked gate member is frozen. A stronger conflicting-choice proxy passes 8/9 main boards, not all nine: board 11 lacks an individually viable/other-doomed alternative on its shortest paths. Some physical gate members are not essential. This is enough evidence that coupling is not merely cosmetic, but not that every board is equally good.

No human playtest, retention test, monetization test, rights/platform acceptance review or revenue evidence exists. The current gate is the bounded free human comprehension/playtest, with additional mobile and compatibility checks before broader distribution. This does not justify paid promotion, monetization, accounts or additional content. Stop and simplify if humans cannot understand the shared action or find it uninteresting.

## Size and dependencies

The five runtime files total 26,678 bytes uncompressed, below the 1 MB target. No external runtime dependencies. Vector visuals are drawn from original code; no licensed assets or fonts are bundled. The browser QA script optionally uses an already installed Playwright/Chromium, and tests require Node/Python; players do not need them.
