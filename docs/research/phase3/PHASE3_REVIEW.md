# P3.7: Measurement and Review

## Decision and Scope

Nonconsecutive peak seasons are approved within the drafted franchise and rolled decade. Preserve existing selections, one- and two-season peaks, and actual-year labels. No processed data changed.

This pass measures and recommends; it does **not** accept the balance targets or change Mid IQ formulas. Engine `season-1`, data `2026-09-14`, random `fnv1a-mulberry32-1`, and scores `conditional-score-1` remain pinned. Sigma 10.5, usage, spacing, qualification thresholds, and score/OT rules are unchanged. No mode, ticker, or playoff implementation is included.

**Recommendation:** Keep the runtime pinned while deciding whether the harder random-play curve is intentional. Chemistry-aware drafting meets the provisional range, but random drafting does not. Do not tune all policies upward merely to meet the random target. Treat score realism as a separate acceptance decision; display-score tuning cannot fix win balance because winners are drawn first.

**Acceptance decision (2026-09-14):** Mid IQ v1 balance is approved with documented exceptions for the missed random-play and bounded-optimization targets. Preserve the measured results and original targets for Phase 9 review; this is not a claim that every target passed. Score acceptance is withheld pending calibration against historical scores, not merely acceptance of the stylized v1 tails. Win probabilities and balance formulas must remain unchanged during that score-only work.

**Historical follow-up:** The [first historical calibration attempt](PHASE3_SCORE_CALIBRATION.md) failed 5/15 held-out checks. After reviewing the failure, the user explicitly chose to retain the experiment and keep the score gate open. The candidate is not active; the measurements below remain the original v1 review, not evidence of a historical-calibration pass.

## Reproduce

```sh
npm test
npm run typecheck
npm run calibrate -- 20 docs/research/phase3/PHASE3_REVIEW_PILOT.json chemistry,reroll-aware,lookahead p3-pilot-
npm run calibrate -- 100 docs/research/phase3/PHASE3_REVIEW.json random,chemistry,reroll-aware,balanced,overloaded,non-shooting,defensive,bench-heavy,lookahead p3-holdout-
```

- [Pilot evidence](PHASE3_REVIEW_PILOT.json): 20 seeds, three policies. Median wins: chemistry 55.5, reroll-aware 60.5, lookahead 68. Lookahead qualified in 18/20 runs. Used only as a feasibility check.
- [Held-out evidence](PHASE3_REVIEW.json): calibration `p3-review-1`; 100 new seeds (`p3-holdout-0` through `p3-holdout-99`) per policy, 900 legal drafts and 73,800 season games. The rollout policy was frozen before this run; no held-out-driven adjustments were made.
- Five separate batches of 100,000 score samples use `p3-score-baseline`, with independent outcome/score streams keyed by probability. These are synthetic fixed-matchup batches, not a league-weighted season distribution. Shared batches are identical in pilot and holdout; do not count them as independent replications.
- The [original 300-seed baseline](PHASE3_BASELINE.md) and its JSON remain preserved. Its eight policies, streams, and original score-batch statistics reproduce unchanged with the expanded harness.
- The CLI accepts sample count (20-10,000), optional JSON output, optional comma-separated policy list, and optional seed prefix. Default selection now includes all nine policies; lookahead is an offline benchmark and substantially slower than greedy policies.

## Legal Rollout Policy

Implementation: [draft-strategy.ts](../../../src/engine/draft-strategy.ts). Policy `legal-rollout-1` uses 12 hypothetical completions per candidate, fixed before the pilot and held-out measurements.

1. Evaluate all three offered coaches. For a visible player roll, shortlist the six best chemistry-greedy player/slot choices plus the best choice for each open slot, deduplicated. Consider each currently legal team/era reroll as another action. An unopened roll must be spun.
2. Apply each candidate through the existing draft functions. Complete hypothetical drafts with chemistry-greedy picks, trying team then era rerolls when the best pick improves projected chemistry by less than 3. Tokens, eligibility, duplicate protection, and playable roll constraints remain enforced. This continuation does not use the old comparator's additional OVR-below-50 trigger.
3. Score completed rosters by expected regular-season wins over the opponent pool, exact tier counts, half home/half away, and 14/82 fatigued games. Use existing game evaluation/probability functions for coach, usage, spacing, depth, and fatigue. This marginal expectation averages possible schedules, not future draws from the current run.
4. Derive hypothetical randomness solely from visible offers, selected coach, placed players, current roll, remaining tokens, and policy version. Candidates share the same sample streams. The API receives only draft state and static data, never the run seed, saved RNG state, realized schedule, or outcomes. Coach selection is optimized as part of the policy, so its benefit is not isolated from pick/reroll improvements.
5. Select the highest sampled mean, using stable candidate order for ties. Re-evaluate after the next actual observation. Terminal expected-win values are cached within the decision; final immediate picks need no continuation sampling.

This is bounded rollout search, **not a global optimum**. Shortlisting may exclude better choices, twelve continuations have sampling error, and the continuation policy is greedy. It is an empirical stronger benchmark, not a claim about human performance or an in-app drafting assistant. The unchanged eight `legal-greedy-1` controls are defined in the original report.

## Held-Out Results

Qualification means 60+ wins. Qualification intervals are 95% Wilson intervals; median intervals use approximate order statistics. Quantiles are linearly interpolated. Uncertainty describes sampled pseudorandom seeds and is not an assurance for every roll.

| Policy | Median Wins | Approx. 95% Median Interval | 10th-90th Percentile | Qualified | 95% Qualification Interval |
| --- | ---: | --- | --- | ---: | --- |
| Random | 32 | 28-35 | 10.9-43 | 0% | 0-3.70% |
| Chemistry | 61 | 60-62 | 52.9-67.1 | 61% | 51.20-69.98% |
| Reroll-aware | 62 | 60-64 | 51.9-69 | 60% | 50.20-69.06% |
| Balanced | 60 | 59-61 | 51-67.1 | 53% | 43.29-62.49% |
| Overloaded | 4 | 3-5 | 1-10 | 0% | 0-3.70% |
| Non-shooting | 17 | 16-19 | 7-27.1 | 0% | 0-3.70% |
| Defensive | 38 | 35-46 | 23-59.1 | 10% | 5.52-17.44% |
| Bench-heavy | 60 | 59-61 | 50.9-68 | 54% | 44.26-63.44% |
| Lookahead | 67 | 66-68 | 59.9-73 | 90% | 82.56-94.48% |

Lookahead's mean expected wins are 66.04 (approximate 95% interval 64.98-67.10), compared with chemistry 60.05 and reroll-aware 59.99. Expected wins average over schedule/outcome uncertainty while preserving the drafted roster. The paired comparison uses matching run seeds, not independently sampled groups:

| Lookahead Compared With | Mean Expected-Win Gain | Approx. 95% Interval | Seeds With Expected-Win Improvement | Mean Realized-Win Gain |
| --- | ---: | --- | ---: | ---: |
| Chemistry | 5.99 | 4.73-7.25 | 91% | 5.62 |
| Reroll-aware | 6.05 | 4.53-7.56 | 78% | 5.71 |
| Balanced | 7.42 | 6.15-8.68 | 90% | 6.97 |
| Bench-heavy | 7.29 | 6.07-8.50 | 90% | 6.74 |

Mean intervals use sample standard deviation divided by square root of count and a 1.96 multiplier, without multiple-comparison correction. The full JSON includes comparisons with all controls, per-seed actions/lineups, schedule-conditioned expected wins, and realized-minus-schedule-expectation residuals. Every policy's residual interval includes zero; this is a sampling diagnostic, not proof of unbiasedness for all seeds.

### Target Assessment

- **Random:** Median 32 versus target 45-55; qualification 0% versus 10-20%. The original 300-seed result (33.5 median, 0.33% qualification) independently shows the same material gap. Zero observed qualifications does not establish a zero true rate.
- **Chemistry:** Median 61 and 61% qualification are within proposed 60-66 and 55-75% ranges. The sample interval for qualification also extends below the target; acceptance is a design judgment, not an assertion of exact population rates.
- **Stronger optimization:** Median 67 versus target 68-74, with median interval 66-68. This is substantially stronger than greedy, but the target is not demonstrated. Seven lookahead runs reached 75+ wins (7%; Wilson interval about 3.43-13.75%); maximum 79. No policy produced an 82-0 season. This sample cannot establish perfect-run rarity, and playoffs/98-0 are not simulated.
- **Archetypes:** Overloaded and non-shooting policies remain heavily punished. Defensive median 38 differs materially from the original sample's 50, despite unchanged code and exact baseline reproduction. These selection heuristics mix talent, fit, roll exposure, and coaching; they are not controlled evidence that a defense rule itself should be buffed.
- **Coverage:** All eight controls select all 12 coaches and all seven eras. Lookahead selects 11 coaches and all seven eras, with coach group counts from 1 to 21. Era-exposure groups overlap. Optimized selection and small groups prevent fair coach/era rankings; absence under the optimized policy is not evidence of invalidity or nonviability.

## Score and Overtime Review

All five input win probabilities and OT targets lie within the corresponding measured 95% Wilson intervals. The target OT rate is `0.06 * 4p(1-p)`. Winner preservation and score invariants pass regression checks; historical realism has not been validated against a real-game reference dataset.

| Input Win Probability | Observed Win Rate | Observed OT Rate | OT Target | Median Regulation Margin | 30+ Point Final Margin | 50+ Point Final Margin |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 5% | 4.989% | 1.160% | 1.140% | 31 | 53.128% | 14.553% |
| 20% | 20.063% | 3.912% | 3.840% | 17 | 20.101% | 3.551% |
| 50% | 49.945% | 6.082% | 6.000% | 12 | 10.735% | 1.632% |
| 80% | 80.096% | 3.822% | 3.840% | 17 | 20.098% | 3.540% |
| 95% | 94.994% | 1.151% | 1.140% | 31 | 53.140% | 14.485% |

Margins are absolute unless identified as win/loss-conditioned. Selected observations:

- The underdog's rare wins are narrower than its losses: at 5% input probability, regulation-win median margin is 8 versus regulation-loss median 32. At 95%, those medians reverse. This is expected conditional-model behavior, not winner reselection.
- The 70-point regulation cap occurs in 244/93,918 regulation games at even strength (0.26%), versus 2,436/98,840 at 5% and 2,429/98,849 at 95% (about 2.46%). A visible point mass is introduced by clamping, not inferred from basketball data.
- The 12-point resolving-OT cap occurs in 242/6,082 OT games at even strength (3.98%) and about 8.19-8.60% at the extreme probabilities. Even matchups have 5,327 one-OT, 664 two-OT, and 91 three-OT games. Period three is forced to resolve, so longer games are structurally impossible.
- Across these batches, final team scores span 57-172 with median 113 in every batch. The shared triangular baseline does not model team-specific pace or separate opponent offense/defense. Plausible central scores alone do not validate totals or margin tails.
- One-point finals range from about 1.49-1.51% at extreme probabilities to 8.154% at even strength. No event implies a buzzer-beater, possession sequence, or box score.

**Recommendation:** Retain outcome-first winner sampling, but do not call the present score distribution historically calibrated. Either explicitly accept its stylized tails, hard caps, and three-OT limit, or choose a reference dataset and tolerances for margins, totals, and OT before authorizing a versioned score change. Changing score spread must not silently change sigma or redraw winners.

## Verification and Remaining Gate

- All 34 engine tests pass; strict TypeScript typecheck passes. New tests cover legal deterministic rollouts, input immutability, hidden-state independence, and expected wins against averages across 500 seeded schedules for each of two drafted rosters.
- All 900 held-out action histories were independently replayed through actual draft/run functions. Coaches, ordered player IDs, wins, and schedule-conditioned expectations matched exactly.
- All original statistics from 2,400 baseline drafts and the three original score batches reproduce unchanged; expanded fields and extra score batches are additive. Original baseline JSON was not overwritten.
- No UI/runtime change was made in this pass, so the prior production/browser checks were not repeated. No external historical-score validation was performed.

**P3.7 remains open for historical score calibration.** Continuity and Mid IQ v1 balance are approved, with the documented target exceptions retained for Phase 9. The first historical candidate failed its fixed held-out checks and was not promoted. Retain that evidence and use a fresh complete reference for any subsequent validation; do not alter win probabilities, silently move targets to No IQ/Low IQ, or claim all provisional targets passed.
