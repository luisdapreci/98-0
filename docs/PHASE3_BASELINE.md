# Phase 3: Runtime and First Baseline

Measured 2026-09-14. The regular-season runtime is implemented; balance acceptance is not complete.

This is the original exploratory measurement. The [P3.7 review](PHASE3_REVIEW.md) subsequently resolves peak continuity, evaluates a stronger legal policy, and records Mid IQ v1 balance approval with target exceptions. The [historical score attempt](PHASE3_SCORE_CALIBRATION.md) failed its gate and was not promoted. The original JSON results below are unchanged.

## Reproduce

```sh
npm test
npm run typecheck
npm run build
npm run calibrate -- 300 docs/PHASE3_BASELINE_RECHECK.json random,chemistry,reroll-aware,balanced,overloaded,non-shooting,defensive,bench-heavy p3-baseline-
```

[Machine-readable results](PHASE3_BASELINE.json) retain distributions, confidence intervals, construction metrics, coach groups, and era-exposure groups. The harness is [src/engine/calibrate.ts](../src/engine/calibrate.ts).

The current harness adds fields and two score batches. This command reproduces all original policy and score statistics in a separate report, not a byte-identical historical JSON file.

- Engine: `season-1`; data: `2026-09-14`; random: `fnv1a-mulberry32-1`; scores: `conditional-score-1`.
- Strategies: `legal-greedy-1`; seeds: `p3-baseline-0` through `p3-baseline-299`, inclusive, for every policy.
- 300 runs per policy, 2,400 legal six-player drafts and 196,800 regular-season games total. A separate score experiment samples 100,000 games at each of p=0.2, 0.5, and 0.8.
- Every draft uses actual coach offers, playable rolls, eligible placements, reroll tokens, and player identity checks. No unrestricted roster substitutes for a draft.
- Existing short peaks and selected seasons are unchanged. Continuity was unresolved at this measurement; nonconsecutive peaks are now approved in the P3.7 review. Balance acceptance remains separate.
- Sigma 10.5, spacing tiers/multipliers, and qualification thresholds are unchanged. Positive-only coach-adjusted bench DBPM is applied before measurement.

## Strategy Definitions

All policies choose a coach uniformly from the three offers using a policy-specific decision stream. Schedule and game draws are shared across policies; selected coaches need not match. Policies never inspect season draws. Ties use player ID, then PG/SG/SF/PF/C/SIXTH order.

The chemistry objective considers each legal player-slot placement, projects 20% usage per missing starter and 8% for a missing bench slot, and scores `base ORTG * projected usage efficiency * spacing multiplier - DRTG + depth bonus`. Projected efficiency uses the existing coach-adjusted usage formula. This is only a selection heuristic, not a simulated replacement player or engine change. Unfilled offense/defense/spacing use existing incomplete-lineup previews.

| Policy | Pick and Reroll Rules |
| --- | --- |
| Random | Uniform over legal player-slot combinations; no rerolls. Multi-position players have more combinations. |
| Chemistry | Greedy maximum chemistry objective; no rerolls. |
| Reroll-aware | Same objective. Tries team, then era, only if legal and the best pick improves the objective by less than 3 or has OVR below 50. Discarded rolls cannot be recovered. |
| Balanced | Chemistry minus `0.5 * max(0, player usage - 24)`; no rerolls. |
| Overloaded | Maximize `player usage + 0.1 * OVR`; no rerolls. |
| Non-shooting | Maximize `0.1 * OVR - 10 * raw expected three-point makes`; no rerolls. |
| Defensive | Maximize raw player DCS plus `0.05 * chemistry objective`; no rerolls. |
| Bench-heavy | Draft the sixth man first by raw FRF, then chemistry-greedy starters; no rerolls. |

These are selection policies, not guaranteed compositions. Construction distributions in the JSON show actual drafted usage, spacing, DRTG, and bench FRF. Reroll-aware is a bounded greedy baseline, **not a validated strong optimizer**. The subsequent P3.7 review evaluates a stronger bounded rollout policy against the 68-74 win optimization target.

## Regular-Season Results

Qualification means 60+ wins. Qualification intervals are 95% Wilson intervals. Median intervals are approximate distribution-free order-statistic intervals; quantiles use linear interpolation. They describe variation across deterministic pseudorandom seeds, not causal effects or forecasts of human performance.

| Policy | Median Wins | Approx. 95% Median Interval | 10th-90th Percentile | Qualified | 95% Qualification Interval |
| --- | ---: | --- | --- | ---: | --- |
| Random | 33.5 | 32-35 | 11-48 | 0.33% | 0.06-1.86% |
| Chemistry | 60 | 60-61 | 51-68 | 55.67% | 50.01-61.18% |
| Reroll-aware | 61 | 60-62 | 52-69 | 59.67% | 54.03-65.06% |
| Balanced | 59 | 59-60 | 50-67.1 | 49.00% | 43.39-54.63% |
| Overloaded | 5 | 4-5 | 1-11 | 0% | 0-1.26% |
| Non-shooting | 17 | 16-19 | 8-28 | 0% | 0-1.26% |
| Defensive | 50 | 47-52 | 23-63 | 22.33% | 17.99-27.38% |
| Bench-heavy | 60 | 59-61 | 49-67 | 52.00% | 46.36-57.59% |

Random play is substantially below the proposed 45-55 median and 10-20% qualification targets. Chemistry is at the lower end of its proposed targets. No constants were tuned to conceal the gaps. Deliberately overloaded and non-shooting policies are heavily punished; separating usage/spacing effects from talent and defense requires controlled follow-up.

All 12 coaches and all seven eras occur under every policy. The JSON includes grouped sample counts and uncertainty. Era exposure means at least one drafted player from that era; groups overlap and do not represent all-one-era teams or isolated era effects. Small groups cannot confidently establish a coach/era ranking.

## Pinned Score Rules

The v1 implementation is [src/engine/season.ts](../src/engine/season.ts). Rules are pinned for replay, but basketball realism still needs review.

1. Sample the final winner once, `U < evaluateGame(...).winProbability`. No score/OT path changes it or reapplies game modifiers.
2. Regulation uses the specified logistic margin conditioned on the chosen winner's side. With selected-side delta `d`, scale `s=10.5`, and quantile `q`, magnitude is `s * (softplus(d/s + log(q)) - log(1-q))`. This stable form does not flip an unconditional draw. Apply `Math.round`, then clamp to 1-70. The cap creates an explicit tail mass.
3. Shared baseline is `round(112 + 20 * (U1-U2))`, a discrete triangular distribution from 92 to 132. Loser score is `max(0, baseline - floor(margin/2))`; winner score is loser plus margin. Odd margins put the midpoint 0.5 above baseline. No independent team-score rounding.
4. OT probability is `0.06 * 4p(1-p)`. Regulation ties at the sampled baseline. At most three extra periods; continuation chance is 0.12 before periods 1 and 2, with period 3 forced to resolve. Continuing periods have equal increments.
5. Each OT baseline is `round(10 + 6 * (U1-U2))`, from 4 to 16. The resolving period uses the conditional magnitude family with selected-side delta multiplied by 5/48, scale 3, and a rounded/clamped 1-12 point margin. This is a game-design approximation, not possession simulation. Never redraw the winner.
6. Finals sum regulation and extra periods. Only `OVERTIME` and `ONE_POINT_FINISH` events exist; no buzzer-beater or box-score claims.

Score draw order: OT decision; two regulation-baseline draws; then either a regulation-margin draw or, for each extra period, a continuation draw if below the cap, two period-baseline draws, and a margin draw only for the resolving period. Winner draws are separate. Changing this order or any parameters requires an engine/score version bump.

| Input p | Measured Win Rate | Measured OT Rate | OT Target | Median Absolute Regulation Margin | Median Absolute OT Margin |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0.2 | 20.063% | 3.912% | 3.84% | 17 | 4 |
| 0.5 | 49.945% | 6.082% | 6.00% | 12 | 3 |
| 0.8 | 80.096% | 3.822% | 3.84% | 17 | 4 |

Each input win probability and OT target lies within its measured 95% Wilson interval. Across the batches, final scores range from 57 to 172, median 113. The 70-point regulation cap is reached 556, 244, and 568 times respectively out of 100,000 games per batch. At p=0.5 there are 5,327 one-OT, 664 two-OT, and 91 three-OT games. These verify implementation behavior, not historical realism. Review the broad logistic margins, caps, triangular baseline, and forced third-period resolution before final balance acceptance.

## Save and Replay Contract

- Seed/ID is generated once by browser `crypto.randomUUID()`. Versioned FNV-1a seed derivation feeds Mulberry32; this is not cryptographic fairness.
- Streams: `draft`, `schedule/opponents`, `schedule/venues`, `schedule/blocks`, `outcome/<game number>`, `score/<game number>`. Cosmetic reels use an independent timer counter and consume no simulation draws. Extra draws in one game's scores cannot shift later games.
- Draft state, random state, and legal action history persist after every action. Draft actions replay on recovery. Data version pins the bundled snapshot; changing processed input data requires a version bump. There is no historical engine/data archive yet.
- Run phases: `DRAFTING`, `DRAFT_READY`, `SEASON_RUNNING`, `SEASON_COMPLETE`. Draft `COMPLETE` means six picks only. Start clones lineup/coach, saves the running state, then resolves all 82 games synchronously. Interrupted running saves finish deterministically. Complete saves validate schedule/rating/score/aggregate invariants and retain outcomes without redrawing them.
- The existing storage key `98-0-draft-v1` now uses envelope/schema version 1. Valid version-0 drafts preserve offers, picks, current roll, and tokens. Their unseeded origin is recorded, with seeded future actions rather than a false claim of reproducible original offers.
- Malformed/unsupported saves open a fresh draft with a notice. Raw data is retained in `98-0-draft-v1-recovery` when storage works; only one backup is retained. Storage failures warn the user while in-memory play remains available.
- These local saves are not tamper-proof, authenticated rankings, or an archive of older engines. Playoffs and ticker reveal progress are not implemented.

## Verification and Remaining Work

- `npm test`: 32 passed, including 100 schedule seeds, 60,000 score-invariant/frequency samples, draft replay, bench correction, interrupted/completed saves, and malformed-state recovery.
- Typecheck and production build passed.
- Production-browser checks: legal draft with early sixth man, Start, all 82 games after a first-game loss, byte-identical completed save after reload, double Start, interrupted resume, legacy migration, invalid JSON/envelope/version backups, and 82 log rows.
- Desktop and 320px screenshots inspected. No page overflow at widths 320, 390, 768, or 1440; the game table scrolls inside a focusable region. These are manual browser checks, not a checked-in browser suite.
- P3.1-P3.6 and the functional regular-season gate are implemented. The subsequent P3.7 review adds a validated stronger bounded policy and resolves peak continuity and Mid IQ v1 balance acceptance with target exceptions. Historical score acceptance remains open after a failed calibration attempt. Pinned runtime v1 values do not mean calibration is finished.
- Ticker, reviewed rivalries, loss autopsy, and playoffs remain Phases 4-5. Qualification does not claim a postseason win or ring.
