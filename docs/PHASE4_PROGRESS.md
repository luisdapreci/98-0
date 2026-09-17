# Phase 4 Progress

Implementation snapshot: 2026-09-14. Status updated: 2026-09-16. P4.1-P4.5 and Phase 5 are now implemented, including reviewed rivalry annotations and the playable championship loop. P3.7 historical scores were subsequently accepted and released as documented in [the second score-calibration report](PHASE3_SCORE_RETRY.md); score acceptance is no longer open.

Current new runs use `season-7` / `mid-iq-3` / `conditional-score-3`, with 135% base usage plus coach adjustments, a 1.5% overload slope and 0.45 floor, and 45-win qualification. Older saves retain their pinned rules. The Runtime, Explanations and Historical Verification sections preserve the original Phase 4 snapshot; current rivalry/postseason behavior and checks are recorded at the end.

## Runtime

- The existing simulation still resolves and saves all 82 games once. Playback never calls simulation or draws randomness.
- A separate `playback` field in the existing Zustand envelope stores the run ID, finished-game count, and tied-overtime stage. The original playback implementation did not change engine/data/score versions or the run schema; later versioned gameplay releases are tracked separately in [the release scorecard](RELEASE_SCORECARD.md).
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
- Roster and chemistry remain accessible. At the original Phase 4 snapshot, qualified runs stated that postseason was unavailable; Phase 5 now supplies an explicit Start Postseason action after all 82 games are revealed.

## Historical Verification (2026-09-14)

- `npm test`: full engine regression suite passes. New tests cover staged overtime, malformed and legacy cursors, hidden future standings, loss explanations, signed defense reconciliation, 50-win tension boundaries and full-season playback/reload invariance.
- `npm run typecheck` and `npm run build`: pass.
- Browser checks on an isolated production origin cover a real six-pick draft, zero revealed results at Start, next reveal, 5x play/pause, refresh, first-loss inspection, tied regulation refresh and instant skip.
- The saved run remains byte-for-byte identical before and after playback, refresh and skip. Browser example: run `cd4754e8-38f5-4181-8d1a-53ff943cfc67`, final 18-64; Game 63's 128-128 regulation score remains tied after refresh until further reveal.
- Desktop and 320px screenshots inspected. At 320px, timeline/control/score/context overflow checks pass; keyboard Enter selects a revealed game, audio can be enabled and muted, and reduced-motion media is honored.
- Validation limits at this snapshot: no checked-in browser runner yet; screen-reader speech and audible heartbeat quality were not manually assessed. Tension boundaries were unit-tested; an actual 50-0 browser run was not observed. The browser-runner gap is now partially addressed below; broader P9.3-P9.4 acceptance remains open.

## Rivalries And Phase 5 (2026-09-16)

- `rivalry-1` includes the six reviewed pairs: BOS/LAL, CHI/DET, IND/NYK, MIA/NYK, BOS/PHI and LAL/SAS. Matches use drafted franchise versions across all six slots, retain stable player evidence and consume no simulation draws. Old saves without rivalry metadata stay unchanged.
- Postseason draws a complete no-repeat exact-squad path before play, uses the specified round multipliers and home sequences, applies home-only seed bonuses once, and has no fatigue. Regular-season, play-in and main-bracket records remain separate. Four bracket series wins earn the ring; only 82-0 plus 16-0 earns 98-0.
- Postseason results and rules are saved once. Separate reveal cursors preserve overtime suspense across reloads; regular-season/playoff tabs retain roster access. Legacy qualifying saves advance under their pinned entry, usage, balance and score rules.
- The first browser run exposed a Node/Edge last-bit `Math.exp` difference in win probability. Save recovery now tolerates at most `2 * Number.EPSILON` for probabilities only, retains saved values, and still rejects altered ratings, scores and larger probability differences. Regression tests cover this boundary. Single-game completion and framework alert-selector issues in browser tests were also corrected.

### Current Verification

- Postseason presentation now includes series scouting previews, home schedules, upcoming stakes, automatic series/clincher/elimination pauses, Finish Series, optional audio, active-round prominence, a 16-win progress tracker and personalized endings. Highlights use revealed outcomes only. Results, simulation versions and save schema are unchanged; interactive coaching is not part of this upgrade.
- P6.1-P6.2 now add No IQ, Mid IQ (default), and HI IQ; Low IQ was removed. Modes pin `iq-1` metadata and lock at coach signing. Legacy saves retain Mid IQ and pinned rules. No IQ disables mapped fit effects but retains individual/bench quality; HI IQ hides scouting information until Start Season. Mid IQ/HI IQ use identical results. See the approved mapping in [the design](GAME_DESIGN.md#chemistry-and-visibility-contract).
- The frozen baseline math source is unchanged. A mode-aware wrapper handles No IQ; original calibration hashes and reports remain valid. A browser parity test compares Mid IQ/HI IQ inside Edge to avoid unrelated Node/Edge last-bit probability differences.
- `npm test`: **98 passed**, including No IQ effect invariance, mode locking/version validation, exact Mid IQ/HI IQ season/postseason parity, legacy saves, and all existing engine/frozen-research regressions.
- `npm run build`: **passed**, including TypeScript checking.
- `$env:PLAYWRIGHT_CHANNEL = 'msedge'; npm run test:browser -- --timeout=30000`: **26 passed**, thirteen journeys each at 1440px desktop and 320px touch/reduced-motion mobile. Mode journeys cover selection/reload/locking/reset, a full six-pick HI IQ draft with dialogs and alphabetical sorting, visibility through completion and reload, Start Season reveal/player profiles, exact browser Mid IQ/HI IQ parity, and No IQ previews/playoffs/autopsies. Existing postseason, rivalry and recovery journeys also pass.
- Mode-selection, HI IQ completion and No IQ result screenshots inspected alongside postseason screenshots; asset loading and overflow checks pass. Rare postseason fixtures use legal drafts with controlled regular-season outcomes. These are functional checks, not measured title/perfect-run frequency, mode balance or human testing. Wider drafting/reroll combinations remain outside the full six-pick HI IQ journey.
- Remaining limits: screen-reader speech, audible quality, wider browser coverage, complete P9 accessibility/performance gates and human playtesting are not signed off. No new balance acceptance or global-ranking claim is made.