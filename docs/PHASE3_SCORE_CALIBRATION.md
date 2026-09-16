# P3.7 Historical Score Calibration: Failed Attempt

## Decision

On 2026-09-14, Mid IQ v1 balance was approved with the original random-play and bounded-optimization target exceptions retained for Phase 9. Historical score calibration remained required before P3.7 closure.

**Result: FAIL, 10/15 held-out checks passed.** The user reviewed the failure and explicitly chose to keep the score gate open and retain this experiment. The proposed `conditional-score-2` rules are **offline candidates only**, not a released version. Active engine `season-1`, scores `conditional-score-1`, win probabilities, saves, and player/coach inputs remain unchanged. No save migration or version bump has been applied.

## Reference and Reproduction

- [Reference snapshot](../data/reference/nba-scores.json): 1,230 completed 2021-22 NBA regular-season games, sourced from ESPN through [sportsdataverse/hoopR-data](https://github.com/sportsdataverse/hoopR-data). Includes factual results, dates, team IDs and overtime counts, plus the source commit, URL, retrieval time and CSV SHA-256.
- The [importer](../scripts/data_pipeline/fetch_score_reference.ps1) verifies unique IDs, season/type/completion filters, integer non-tied scores, 30 teams, and exactly 82 games per team. Preseason, playoffs, All-Star and unfinished/postponed entries are excluded.
- The 2022-23 repository archive was incomplete: 1,175 completed regular-season entries plus 56 unfinished entries. An attempted ESPN supplement was denied. It was not included. A release-asset check found no schedule assets to substitute.
- The split was fixed before fitting: 750 games before `2022-02-01T00:00Z` for fitting; 480 games from that cutoff onward for validation. This is one season, not evidence of stability across eras or multiple seasons.
- [Fit evidence](PHASE3_SCORE_FIT.json) and [held-out evidence](PHASE3_SCORE_VALIDATION.json) pin the reference digest. Validation also pins the fit artifact digest and checks that tolerances have not changed.

Use the committed snapshot for offline reproduction:

```sh
node --experimental-strip-types src/engine/calibrate-scores.ts fit
node --experimental-strip-types src/engine/calibrate-scores.ts validate
npm test
npm run typecheck
```

The validation command intentionally exits nonzero while retaining the JSON report. Re-running `fit` reproduces the experiment, not a new independent validation. Refreshing the reference with the PowerShell importer changes its retrieval metadata/digest; re-fit and revalidate against that snapshot, and retain prior artifacts before starting a different experiment.

## Method

The [calibration harness](../src/engine/calibrate-scores.ts) calls the actual `sampleOutcome` implementation with explicit candidate rules; the default runtime remains v1. No parallel implementation of score generation is used.

Historical team net-rating inputs are unavailable in this archive. A fixed proxy uses each team's **prior-games-only mean point differential**, shrunk toward zero with a ten-game prior, plus 2.5 for home court; sigma stays 10.5. It is not an opponent-adjusted rating or a calibrated historical win predictor. Scores are sampled conditional on the **observed historical winner**. This tests conditional score distributions, not winner forecasts or a league-wide win model.

Training fits the shared triangular baseline's center/spread from non-OT totals, OT probability from the observed rate adjusted by `4p(1-p)`, and continuation probability from observed extra-period counts. OT center is estimated from average excess totals per extra period and bounded to 6-14. The archive lacks period scores: this approximation mixes selection effects with actual period scoring; OT spread remains fixed at 6 rather than claiming to be measured.

Regulation scale is searched over 5-10.5 in 0.5 steps, then OT scale over 2-5 in 0.5 steps, using training-only discrepancies divided by the fixed metric tolerances. Each trial uses 40 draws per historical game; the final training report uses 100. Candidate regulation margins use `round(magnitude) + 1` instead of merging rounded zero and one into one-point finishes. Safety caps are 100 for regulation margin, 30 for resolving-OT margin, and six OT periods; these are computational guardrails, not estimated historical maxima.

The held-out report uses 200 draws per game (96,000 conditional draws), independent of training game streams. These reduce Monte Carlo error, but the historical sample size is still **480 games**, including only 27 OT games, not 96,000 independent historical observations. Seeds are `historical-score-fit-1` with streams keyed by historical game ID. All generated winners are asserted to match the conditioning winner; separate engine tests verify Bernoulli outcome frequencies and winner preservation under score-only candidates.

## Held-Out Evidence

Tolerances were fixed in the harness before the first fit/validation. Rate tolerances below are absolute percentage points, not relative percentages. They are engineering acceptance bands, not confidence intervals. No band was widened after the failure.

| Metric | Historical | Active V1 | Candidate | Tolerance | Candidate Gate |
| --- | ---: | ---: | ---: | ---: | --- |
| Mean combined score | 227.125 | 225.663 | 217.324 | 4 points | FAIL |
| Combined-score standard deviation | 19.264 | 17.330 | 19.571 | 3 points | PASS |
| Combined-score 10th percentile | 202.9 | 203 | 191 | 5 points | FAIL |
| Combined-score 90th percentile | 251 | 249 | 243 | 5 points | FAIL |
| Mean absolute margin | 12.975 | 14.974 | 11.841 | 1.5 points | PASS |
| Median absolute margin | 11 | 12 | 10 | 2 points | PASS |
| Absolute-margin 90th percentile | 28 | 32 | 24 | 3 points | FAIL |
| 30+ point margin | 8.333% | 12.609% | 5.082% | 2.5 pp | FAIL |
| 50+ point margin | 0.417% | 2.036% | 0.342% | 0.8 pp | PASS |
| One-point final | 3.333% | 7.293% | 3.713% | 2.5 pp | PASS |
| OT frequency | 5.625% | 5.454% | 4.020% | 2 pp | PASS |
| Mean OT margin | 4.741 | 4.227 | 4.346 | 1.5 points | PASS |
| OT-margin 90th percentile | 8 | 9 | 9 | 4 points | PASS |
| Mean OT combined score | 247.630 | 247.031 | 238.885 | 12 points | PASS |
| Multiple OT, among OT games | 7.407% | 11.727% | 18.554% | 12 pp | PASS |

Training mean combined score was 217.46, compared with 227.125 in the held-out period. The candidate captured the earlier scoring level but did not generalize to the later level. The training one-point pile-up was reduced from about 9.2% in the initial candidate to 3.87% after the discretization change, against 3.2% observed; that revision occurred **before** held-out evaluation.

The candidate reduces some excessive v1 tails, but misses the held-out 90th-percentile margin and 30+ rate. It is not an across-the-board improvement. One regulation cap and one OT-margin cap occurred in its 96,000 held-out draws, versus 263 and 222 under v1. Guardrail hits remain diagnostic observations, not proof that tails are realistic. The OT continuation estimate is especially uncertain with this small historical sample.

## Remaining Work

P3.7 stays unchecked. A subsequent attempt needs a revised method for scoring-level drift and margin shape, a fresh complete reference, and predeclared acceptance criteria. The now-exposed 480-game partition may inform development but cannot be presented as fresh held-out validation. Do not promote the candidate, tune parameters on this holdout and call it independent evidence, or relax tolerances solely to close the task.

The implemented work is limited to the validated reference importer, offline fit/validation harness, optional score-candidate parameterization, and regression coverage for winner preservation and positive-margin rounding. Existing active v1 behavior is preserved.

**Verification:** All 36 engine tests and strict typechecking pass. Every score statistic in the three original 100,000-draw v1 batches reproduces exactly, and the active score version remains `conditional-score-1`. Historical candidate validation deliberately fails with the five recorded gate failures. Source/report diagnostics and local documentation links pass; unrelated existing design-document style warnings remain. No UI change was made, and production/browser checks were not repeated.
