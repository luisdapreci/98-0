# Phase 4 Progress

Date: 2026-09-14. P4.1, P4.2, P4.4 and P4.5 implemented. P4.3 remains open for review and implementation of rivalry annotations. P3.7 historical-score acceptance is unchanged and still open.

## Runtime

- The existing simulation still resolves and saves all 82 games once. Playback never calls simulation or draws randomness.
- A separate `playback` field in the existing Zustand envelope stores the run ID, finished-game count, and tied-overtime stage. Engine/data/score versions and the run schema are unchanged.
- New seasons and refreshed playback start paused. Play advances every 1,200 ms at 1x or 240 ms at 5x; hidden tabs do not advance. Next reveal pauses automatic playback; skip reveals the saved final result immediately.
- Overtime reveals tied regulation, then any tied extra periods, then the stored final. Intermediate scores, accessible labels, standings and logs exclude unrevealed results. Completion and qualification appear only after all 82 games are revealed.
- Old completed saves without playback metadata retain their already-visible final result. Malformed or wrong-run cursors reset to zero without discarding the season. Invalid overtime stages reset to the beginning of that game's reveal.
- Timeline nodes carry W/L/OT labels, with green wins, red losses and gold overtime wins. Revealed games can be inspected with keyboard or pointer. No buzzer-beaters or unsupported rivalry claims are generated.
- At 50 or more revealed wins without a loss, the unfinished season gains a tension state. Audio is opt-in and muted again on reload; reduced-motion media settings disable visual animation. Audio does not affect playback or simulation randomness.

## Explanations

- The first revealed loss remains inspectable without stopping playback. It includes the score, pre-game probability, actual rating context and at most three model disadvantages, explicitly not proven causes of the loss.
- The presentation ranks recorded negative usage, spacing, fatigue, defensive-baseline and opponent-rating effects by magnitude. It reports effects of at least 1 rating point, a presentation significance threshold only, not an engine or balance change. It does not fill unused explanation slots.
- A favored team with no qualifying disadvantages gets the upset explanation. Even and underdog cases have probability-appropriate fallbacks. No player box scores, shooting percentages or turnovers are fabricated.
- Defense feedback reuses the existing coached, pace-adjusted formula and exposes signed rim, perimeter, team-support and liability terms. The five-starter team-support term remains distinct from bench depth. An explicit display-rounding row, only when necessary, reconciles two-decimal contributions with total DRTG.
- Roster and chemistry remain accessible. Qualified runs explicitly state that postseason is not available yet.

## Verification

- `npm test`: full engine regression suite passes. New tests cover staged overtime, malformed and legacy cursors, hidden future standings, loss explanations, signed defense reconciliation, 50-win tension boundaries and full-season playback/reload invariance.
- `npm run typecheck` and `npm run build`: pass.
- Browser checks on an isolated production origin cover a real six-pick draft, zero revealed results at Start, next reveal, 5x play/pause, refresh, first-loss inspection, tied regulation refresh and instant skip.
- The saved run remains byte-for-byte identical before and after playback, refresh and skip. Browser example: run `cd4754e8-38f5-4181-8d1a-53ff943cfc67`, final 18-64; Game 63's 128-128 regulation score remains tied after refresh until further reveal.
- Desktop and 320px screenshots inspected. At 320px, timeline/control/score/context overflow checks pass; keyboard Enter selects a revealed game, audio can be enabled and muted, and reduced-motion media is honored.
- Remaining validation limits: no checked-in browser runner yet; screen-reader speech and audible heartbeat quality were not manually assessed. Tension boundaries are unit-tested; an actual 50-0 browser run was not observed. Repeatable browser/release coverage remains P9.3-P9.4 work.

## Remaining P4.3 Work

Review the initial canonical franchise rivalry pairs before shipping any alert. Then implement deterministic annotation, persist supporting franchise/player evidence without invalidating existing results, and cover symmetry, sixth-man matches, multiple pairs, no-match cases, franchise versions and unchanged simulation state. No rivalry dataset or annotation is included in this change.