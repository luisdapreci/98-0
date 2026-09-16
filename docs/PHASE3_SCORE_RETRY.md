# P3.7 Historical Score Calibration: Second Attempt

## Predeclared Protocol

Recorded before fetching the new references or evaluating the new holdout. This is an offline experiment, not permission to release new score rules. Preserve the [failed first attempt](PHASE3_SCORE_CALIBRATION.md), its references and reports, and active `conditional-score-1` behavior.

- Development reference: complete 2023-24 regular season (season ending 2024). Validation reference: complete 2024-25 regular season (season ending 2025), evaluated only after the candidate is frozen. Require 1,230 unique completed games, 30 teams and 82 games per team in each snapshot. Do not substitute another season based on score statistics or silently accept incomplete data.
- Pin source commit (archive) or release asset ID (release download), plus source SHA-256 in separate reference snapshots. Fit reads only the development snapshot; validation checks its digest and the frozen fit artifact. The exposed 2021-22 validation partition is not fresh evidence.
- Scoring-level revision: estimate the constant shared baseline from an entire development season rather than an early-season prefix. This addresses within-season sampling imbalance, not future scoring-level drift. Do not use validation scores to recenter predictions or invent team offense/defense profiles.
- Margin revision: jointly search regulation scale (5 to 10.5 in 0.25 increments) and rounding offset (0 or 1), minimizing the largest training discrepancy normalized by its fixed tolerance across mean, median, 90th percentile, 30+ rate, 50+ rate and one-point rate; use summed squared normalized error to break ties. Retain the conditional logistic family and winner selection. This gives tail shape and close finishes an explicit fitting role rather than only minimizing aggregate squared margin error.
- Reuse the prior-games-only mean point-differential proxy, ten-game zero prior, +2.5 historical home adjustment, and sigma 10.5. Condition on observed historical winners; this is not validation of historical win forecasts or the game's draft balance.
- Retain the first attempt's baseline/spread and overtime estimators, OT scale grid (2 to 5 in 0.5 increments), safety limits (100 regulation margin, 30 OT margin, six periods), and fixed OT spread of 6. Period scores are not included in this experiment's normalized reference, so the OT baseline is an approximation, not a measured period-scoring model.
- Use 40 draws per game for fitting trials, 100 for the final development report and 200 for held-out evaluation, with a separately named deterministic experiment stream. Freeze all candidate parameters before validation. Monte Carlo draws do not increase the number of independent historical games.
- Keep all 15 original acceptance bands unchanged: total mean 4, SD 3, p10/p90 5; margin mean 1.5, median 2, p90 3; 30+ rate 0.025, 50+ rate 0.008, one-point rate 0.025; OT rate 0.02, mean margin 1.5, p90 margin 4, mean total 12, multiple-OT share 0.12. Rates use absolute fractions. Every gate must pass; these are engineering tolerances, not confidence intervals.
- Persist fit and validation separately from the old artifacts and refuse accidental overwrites. Evaluate the holdout once. Retain a failure without tuning against it or widening tolerances. Passing supports a promotion review, not automatic runtime changes or P3.7 closure.

## Status

**ACCEPTED AND RELEASED, 2026-09-14: 15/15 unchanged held-out gates.** The user accepted the frozen candidate after reviewing this report. New runs use `season-2` / `conditional-score-3` with the exact fitted numeric parameters; existing versioned v1 saves retain their original rules and stored results. P3.7 is complete. Win probabilities, draft rules, player/coach data, random algorithm and save schema remain unchanged. The candidate was fitted and frozen before the 2024-25 reference was downloaded or evaluated; the original fit/validation artifacts remain unmodified.

## Reference Evidence

The old hoopR-data archive has no 2024 CSV and its schedule archive stops at 2023. Direct ESPN access was denied. The current [SportsDataverse schedule release](https://github.com/sportsdataverse/sportsdataverse-data/releases/tag/espn_nba_schedules) supplies both predeclared seasons. No season was substituted based on observed scores.

| Role | Snapshot | Games | OT Games | Release Asset ID | Source CSV SHA-256 |
| --- | --- | ---: | ---: | --- | --- |
| Development | [2023-24](../data/reference/nba-scores-2024.json) | 1,230 | 59 | 493697559 | `ae89a6e51dec1817b41e457d02ffc4cfc26d25b411d318906c1ec5f39a6c5527` |
| Held Out | [2024-25](../data/reference/nba-scores-2025.json) | 1,230 | 60 | 493698993 | `a7a5b6607a256c84a324f819e4461248bdff90a78b1ddb675a5a117a9a94e74f` |

The importer checks the published digest against raw downloaded bytes before UTF-8 CSV parsing. It accepts whole-valued decimal period fields such as `4.0`, but rejects fractional, negative, missing or overflowing values. Both snapshots pass unique IDs, completed regular-season filters, non-tied integer scores, 30 teams, and exactly 82 appearances per team. NBA Cup finals and postseason games do not enter the 1,230-game workload. Release tags are mutable, so asset IDs, update times and source hashes are saved; a download whose digest differs from its asset metadata is rejected. Offline reproduction uses the retained snapshots, not a newly fetched release.

## Frozen Candidate

[Fit evidence](PHASE3_SCORE_FIT_2.json) contains all 46 joint regulation trials, seven OT trials, complete rules, training summaries, and implementation fingerprints. [Held-out evidence](PHASE3_SCORE_VALIDATION_2.json) pins the fit artifact and both reference digests. The implementation fingerprint covers the harness, season sampler, math and random source; changing them invalidates this replay rather than silently producing new evidence.

- Archived candidate label: `conditional-score-3-candidate`. Released label: `conditional-score-3`; only the label differs, not the numeric parameters.
- Shared baseline: 113.445132; triangular spread: 24.044916.
- Regulation logistic scale: 8; positive-margin rounding offset: 1; safety cap: 100.
- Maximum OT probability: 0.052149, multiplied by `4p(1-p)`; OT logistic scale: 3; margin cap: 30.
- OT baseline: 9.477421; spread: 6; continuation probability: 0.119403; period cap: six.
- Training summary: 123,000 conditional draws. Held-out summary: 246,000 draws. Stream namespace: `historical-score-fit-2`, keyed by historical game ID. Fit/validation IDs are disjoint. Winner assertions pass for every draw.

## Held-Out Results

Rate tolerances are absolute percentage points. All other tolerances are points. Every candidate gate passes; passing does not imply every metric improves over v1.

| Metric | Historical | Active V1 | Candidate | Tolerance |
| --- | ---: | ---: | ---: | ---: |
| Mean combined score | 227.650 | 225.744 | 228.380 | 4 |
| Combined-score SD | 19.781 | 17.313 | 20.309 | 3 |
| Combined-score p10 | 202.9 | 203 | 201 | 5 |
| Combined-score p90 | 253 | 249 | 255 | 5 |
| Mean absolute margin | 12.748 | 15.222 | 12.675 | 1.5 |
| Median absolute margin | 10 | 12 | 10 | 2 |
| Absolute-margin p90 | 26 | 33 | 26 | 3 |
| 30+ margin | 6.504% | 13.121% | 6.613% | 2.5 pp |
| 50+ margin | 0.407% | 2.146% | 0.566% | 0.8 pp |
| One-point final | 4.472% | 7.236% | 3.747% | 2.5 pp |
| OT frequency | 4.878% | 5.435% | 4.708% | 2 pp |
| Mean OT margin | 4.483 | 4.254 | 4.378 | 1.5 |
| OT-margin p90 | 8 | 9 | 9 | 4 |
| Mean OT combined score | 247.517 | 247.436 | 249.242 | 12 |
| Multiple OT among OT games | 6.667% | 12.430% | 12.597% | 12 pp |

Candidate guardrail hits: three regulation caps, zero resolving-OT caps, zero period caps in 246,000 draws. V1 reached these limits 790, 623 and 204 times respectively, but its limits differ, so those counts are diagnostics rather than like-for-like realism scores.

## Limits and Promotion

There are 1,230 independent held-out game records, not 246,000 independent historical observations. Only 60 historical games went to OT and four went to multiple OT. The candidate's multiple-OT share remains almost twice the observed share while passing the original broad tolerance. Do not describe that estimate as precise. These engineering bands are not statistical confidence intervals.

The source CSV contains line-score fields, but this attempt deliberately retains the original aggregate-only OT estimator; it does not validate period-level scoring realism. The matchup proxy is not an opponent-adjusted historical rating or a win-probability calibration. Two adjacent modern seasons do not demonstrate stability across all eras, future league scoring changes, or every extreme drafted lineup. Full-season fitting avoided the previous early/late sampling imbalance here; it is not a general drift correction.

**Acceptance decision:** On 2026-09-14, the user accepted the second candidate, including the limitations above. The released numeric parameters exactly match the frozen fit. The original failed experiment remains intact, and neither exposed holdout may be called fresh validation in a later tuning attempt.

### Save Compatibility

- New runs are pinned to `season-2` / `conditional-score-3` when created.
- Existing versioned `season-1` / `conditional-score-1` runs retain that pair during draft actions, refresh, season start, interrupted resolution, completion and playback. Completed scores are validated and preserved, never resampled. Draft-only legacy saves without version metadata migrate into a new current-version run while retaining their picks and offers.
- Recovery accepts only the two released engine/score pairs, alongside the unchanged data and random versions. Failed `conditional-score-2`, candidate-only labels, mismatched pairs and unknown versions are not supported saves.
- Save schema 1 and the existing local-storage key remain unchanged. There is no destructive migration or automatic restart. Starting a new run opts into the new score model; an existing draft stays on its pinned version.
- Identical seeds and lineups retain identical schedules, game evaluations and sampled winners across releases. Scores, OT labels and point differential can differ; these are versioned simulation changes, not cosmetic updates.

### Released Randomness

Random draw order is unchanged: one outcome draw; then the score stream draws OT selection, two baseline uniforms, and either a regulation-margin quantile or OT periods. Each OT period draws continuation unless it is the last permitted period, two period-baseline uniforms, and a margin quantile only if resolving. The release changes parameters and permits up to six periods; it does not change stream seeds or the random algorithm. Each game has separate outcome and score streams, so additional periods cannot shift another game's draws.

## Reproduction and Verification

Use the retained files for read-only reproduction:

```sh
node --experimental-strip-types src/engine/calibrate-scores.ts replay-release
npm test
npm run typecheck
npm run build
```

The original one-time execution sequence was:

```powershell
./scripts/data_pipeline/fetch_score_reference.ps1 -Season 2024 -OutputPath data/reference/nba-scores-2024.json -SplitDate 2024-07-01 -ReleaseAssetId 493697559
node --experimental-strip-types src/engine/calibrate-scores.ts fit-next
./scripts/data_pipeline/fetch_score_reference.ps1 -Season 2025 -OutputPath data/reference/nba-scores-2025.json -SplitDate 2025-07-01 -ReleaseAssetId 493698993
node --experimental-strip-types src/engine/calibrate-scores.ts validate-next
```

`fit-next` and `validate-next` reject existing artifacts; reference import also rejects existing new-season snapshots. The original `replay-next` remains strict about the pre-promotion implementation fingerprints and intentionally rejects the changed release implementation. Use `replay-release` now: it verifies released parameters against the frozen fit, simulates using the active released rules, and compares all retained report fields except implementation fingerprints. It prints the current implementation fingerprints separately and writes nothing. Source and fit digests, all summaries, cap counts, gates and tolerances must still match exactly. This is a compatibility check against exposed evidence, not fresh validation. The retry uses whole seasons; snapshot split-date fields are unused by this branch.

Verification: 44 engine tests pass, including wider candidate score bounds, six-period OT accounting, extreme draws, unchanged sampled winners and deterministic replay. Strict typechecking passes. Held-out replay matches exactly without changing the report; overwrite guards reject both fitting and validation. All 15 tolerances match the first experiment exactly, and the original reference and fit still match their retained evidence hashes. No UI or active engine change was made; production/browser checks were not repeated.

**Promotion verification:** 46 engine tests and the production build pass. New tests cover v1 drafts at each pick, interrupted and completed v1 recovery, strict version pairing, released 100-point regulation and 30-point OT margins, and six-period OT recovery/playback without result mutation. Released historical replay reproduces every saved v1 and candidate statistic with the accepted numeric parameters. The retained validation artifact SHA-256 is `e8e93899c572ada9edcab2b39ff61ac713fb73bd1c8551b98a84adb942836980`. No UI code changed; browser checks were not repeated for this score-only promotion.
