# Roster-First Calibration

**Current decision:** the user-approved [bounded integration cycle](MID_IQ_INTEGRATION_1_PROTOCOL.json) stopped at its [missing-turnover masking gate](MID_IQ_MISSING_TURNOVERS_RESULT_1.json): bias and interval coverage failed. Candidate 2 retains its component pass, but no historical data were filled and no complete-strength mapping was attempted. Keep live balance and every historical player; no complete-game finalist, fresh-family measurement or human evaluation has been consumed. The original two-mechanism cycle is exhausted and the follow-up's failure rule prohibits another estimator or retune without approval. Historical statements below retain their original scope and decisions.

**Current product work:** the user approved [exploratory feedback on the current game](../../playtests/BASELINE_PLAYTEST.md) on 2026-09-15. The six-person session kit and empty observations are ready; production build and limited desktop/320px journeys passed. Human sessions remain 0 of 6. This is not the scorecard's finalist pilot or evidence of improved balance. Model research remains paused while real participant observations are collected.

**Subsequent product direction:** the user requested more usage tolerance for star-studded rosters. A local `season-4` preview now uses a 135% base cap for new runs, with coach bonuses and existing penalties above the cap retained. Older saves and all frozen research remain unchanged. See [the scorecard's usage-preview record](../../release/RELEASE_SCORECARD.md#user-requested-usage-preview) for the one-roster comparison and verification limits. This does not reopen the failed turnover research or turn the old playtest build into evidence for the new cap.

## Premeasurement Decisions (2026-09-15)

User authorized autonomous balancing after approving the 13 decisions in [the review](MID_IQ_ROSTER_REVIEW.md). Keep those targets fixed; do not fit player IDs, coach IDs, roster labels or seeds. Preserve live season-3 and old-save behavior until a candidate passes validation.

Stored-record checks, made before benchmark performance:

- F04 retains the approved 30-40 target: Lakers Nash 11.7 PPG/6.5 APG, Bulls Wade 18.3 PPG, Lakers Anthony 13.3 PPG, Nets Garnett 6.6 PPG and Cavaliers Shaq 12 PPG. These are diminished but useful versions, not prime superstars. This supports the tier judgment, not proof of a precise win total.
- V01: Houston Brooks has 13.4 versus 10.6 PPG, 5.7 versus 3.1 three-point attempts, .379 versus .358 shooting, -0.1 versus -1.1 DBPM and 17.7 versus 18.8 usage. Expect improvement, allowing slightly worse FG%/steals and different pace factors.
- V04: Hawks Horford has 15.6 PPG/9.8 RPG/3 APG/.550 FG%/.7 DBPM against Thompson's 6.6/6.7/1.5/.477/.2. Confirm the clear reserve upgrade and use the approved 2-4 expected-win gain as a gate.
- V07: prime Kobe's 31.2 PPG/5.3 APG/.453 FG%/.5 DBPM versus young Kobe's 15.4/2.7/.439/-.3 supports the required downgrade, despite lower usage.
- V08: Ginobili's 17.4 PPG/4 APG/.465 FG%/2.7 DBPM versus Fisher's 10.9/2.9/.424/.3 supports the required reserve improvement. No mandatory numeric delta was approved for this pair.

## Gates and Method

Measure 15 development rosters first; keep all nine reserved rosters' performances hidden until a candidate is frozen. Average exact conditional win distributions across 64 seeded schedules, report expected wins, schedule sampling error, 60+ probability, season quantiles and 82-0 probability. Games are not independent roster observations. Bands describe expected wins, not every season's result.

Release gates: every approved development and validation expected-win band must pass; V01/V08 improve, V03/V07 worsen, V04 gains 2-4, V06 stays equal within floating-point tolerance. V02 has no required direction. Coach differences are contextual: inspect the all-coach range and paired fits; do not demand V05 has a 2-4 difference or fit IDs to manufacture a ranking. Treat clear outlying coach dominance as a release risk. Qualitative delta thresholds were not approved; report actual sizes instead of inventing them.

Use fresh legal drafts separately to assess challenge: compare random, rating-led and fit-aware selection, paired by seed. Report distributions and qualification probabilities, not claims about human enjoyment. Strong selections should outperform random selections without making qualification universal across ordinary drafts. No new numerical human-success-rate target is assumed.

One mechanism at a time, with ablations. Freeze a candidate and its hashes before reserved-family evaluation. If validation fails, do not silently retune on those cases or promote the candidate. A failed experiment is a reportable result; live balance should remain unchanged.

## Outcome: Not Released

**Balancing is not release-ready.** Frozen fit 18 passed all 15 development bands and upgrade gates, but [the first reserved validation](MID_IQ_ROSTER_VALIDATION_1.json) passed only 4/9 bands. All nine reserved families are now exposed. Live season-3 / mid-iq-2 / conditional-score-3 remains unchanged. No saved seasons were rewritten, no player or coach data was changed, and no benchmark targets were relaxed. Earlier sections retain the development history; the reserved outcome below is the current verdict.

The frozen [catalog](../../../data/reference/mid-iq-roster-benchmarks.json) retains its September 14 review-time status and hash for reproducibility. Its `performanceEvaluated: false` describes that expectation freeze, not the subsequent development work here. September 15 authorization supersedes the review-only restriction for this calibration task. The conditional record checks above are resolved for this experiment, without editing the frozen expectations.

### First-Cycle Evidence

| Experiment | Development Bands Passed | Main Finding |
| --- | ---: | --- |
| [Released baseline](MID_IQ_ROSTER_BASELINE.json) | 5/15 | Full-rating usage penalties erase elite talent; reserve and Kobe upgrades reverse |
| [Usage only](MID_IQ_ROSTER_USAGE_EXPERIMENT.json) | 9/15 | Restricting usage to player offense and removing reserve usage fixes all three reversed upgrades |
| [Continuous spacing](MID_IQ_ROSTER_SPACING_EXPERIMENT.json) | 8/15 | Removes cliffs and strengthens prime-Kobe advantage; insufficient by itself |
| [Shared fit 1](MID_IQ_ROSTER_FIT_1.json) | 6/15 | Linear usage, top-one blend; upgrades pass but roster identities remain uneven |
| [Shared fit 2](MID_IQ_ROSTER_FIT_2.json) | 7/15 | Top-two blend improves the two-star support case |
| [Shared fit 3](MID_IQ_ROSTER_FIT_3.json) | 10/15 | Smooth congestion, every directional comparison passes; largest band miss 0.42 wins |
| [Band-prioritized fit 4](MID_IQ_ROSTER_FIT_4.json) | 11/15 | Closer bands but young Kobe becomes an upgrade again; defensive scaling falls to 0.418 |

Only the 15 development rosters are included in these counts. A near miss is still a failed approved band, not a rounded pass. Fits 1-4 are exploratory shared-parameter searches, not independent tests. Nine parameters fitted to 15 rosters carry substantial overfitting risk. The same development schedules are reused deliberately; a later release would require untouched-family and fresh-schedule checks.

### Better-Behaved Candidate (Fit 3)

This candidate was selected for stress testing because it passes all directional comparisons, not because it passes release gates. Parameters were frozen in its report before the draft/coach stress run. The final candidate module still reproduces its recorded neutral evaluations exactly.

| Roster | Approved Band | Released Expected Wins | Candidate Expected Wins |
| --- | ---: | ---: | ---: |
| C01: user's team | 59-63 | 60.36 | 60.99 |
| C02: Shaq/Kobe support | 64-68 | 63.18 | 63.77 |
| C03: Jordan support | 64-68 | 64.46 | 65.50 |
| C05: Nash/Dirk spacing | 64-68 | 64.40 | 67.55 |
| C06: Paul/Garnett | 64-68 | 67.74 | 67.52 |
| C07: LeBron support | 64-68 | 71.82 | 67.86 |
| C10: Payton/Kemp/Ewing | 64-68 | 36.33 | 63.92 |
| E02: all-time inside-out | 69-74 | 19.47 | 68.62 |
| E03: Jordan/Bird twin anchors | 69-74 | 30.69 | 71.11 |
| E04: shooting around Hakeem | 69-74 | 39.45 | 71.83 |
| E05: Magic two-big team | 69-74 | 24.91 | 69.14 |
| F01: overloaded stars | 64-68 | 2.73 | 68.16 |
| F02: offense-first | 59-63 | 11.54 | 62.96 |
| F03: Wade/Kidd defense | 59-63 | 65.50 | 63.42 |
| F04: late-career names | 30-40 | 37.27 | 37.52 |

Fit 3 misses C02, C10, E02, F01 and F03. Schedule sampling errors, qualification probabilities, 5th/50th/95th season-win percentiles and undefeated probabilities are retained in the reports. They are estimates conditional on this model and opponent pool, not historical forecasts.

| Variant | Released Win Difference | Candidate Win Difference |
| --- | ---: | ---: |
| V01: Houston Brooks | +2.10 | +2.31 |
| V02: Rodman for Bowen | -8.68 | -2.40 |
| V03: Tucker for Jordan | -4.38 | -16.39 |
| V04: Horford reserve | -0.63 | +3.85 |
| V05: Popovich for Sloan | +0.09 | -0.70 |
| V06: PF/C swap | 0 | 0 |
| V07: young Kobe | +9.09 | -0.92 |
| V08: Ginobili reserve | -2.36 | +2.80 |

V03 is clearly weaker, but its 16-win drop deserves sensitivity review; no numeric bound for that loss was approved. V02 and V05 have no mandatory sign. Fixing an upgrade reversal is necessary, not sufficient evidence of realistic basketball behavior.

### Challenge and Coach Stress

[Stress report](MID_IQ_ROSTER_STRESS_1.json): 100 fresh seeds per policy, 400 completed drafts, all action histories replay-validated. Each drafted team is evaluated under both models using the same schedule and outcome draws. There are no rerolls or optimized coach selections. Greedy policies estimate missing slots with pool-mean statistics and select by the respective model; they are not human behavior or the existing multi-roll lookahead policy.

| Draft Policy | Released Median Expected Wins | Candidate Median Expected Wins | Candidate Mean Qualification Probability | Candidate Actual Qualifiers |
| --- | ---: | ---: | ---: | ---: |
| Random legal choice | 34.82 | 36.34 | 2.7% | 3/100 |
| Highest displayed rating | 17.75 | 64.65 | 78.6% | 78/100 |
| Greedy released-model fit | 62.84 | 62.13 | 65.2% | 67/100 |
| Greedy candidate-model fit | 41.08 | 71.58 | 98.6% | 97/100 |

Talent selection becoming useful is desirable. However, near-certain qualification from a simple greedy policy without rerolls is a substantial challenge risk. It does not prove human players would find the game easy, nor does it establish a population success rate. No arbitrary new qualification-rate gate has been substituted for the user's goals. It is a reason not to release an already-failing candidate and to include stronger policy stress in the next experiment.

All 12 coaches were evaluated on each of the 15 development rosters. Their best-to-worst expected-win spread was 2.01-4.36. Despite mostly matching the desired magnitude, **Nelson or Auerbach ranked first on all 15**, while Popovich or Brown ranked last on all 15. The continuing flat pace advantage is not convincing contextual coaching. V05 alone would have missed this systematic problem.

### Candidate Formula and Reproducibility

The experimental [candidate module](../../../src/engine/roster-balance.ts) is not imported by live run, season or UI code. Its only consumers are the offline evaluator and regression tests.

- Start from the released blend of all-five and top-three offensive contributions, then blend toward the top-two mean with `leadScorerWeight`. The parameter name originated in fit 1, which used the top-one maximum; fits 2-4 use the top-two mean.
- Scale coach stat changes by `coachScale` before blending offensive, defensive, spacing and reserve features. Retain a scaled flat pace term for this experiment; its dominance is a rejected aspect, not an endorsed final design.
- Let excess be starter usage above 115 plus the scaled coach cap adjustment. Exclude reserve usage from simultaneous starter demand. Fit 1/2 use `max(0.5, 1 - usageSlope * excess)`; fit 3/4 use `1 / (1 + usageSlope * excess^2 / 30)`.
- Effective offense is `offenseBaseline + offenseScale * blendedContribution * usageFactor + spacingPoints`. The team baseline is not multiplied by usage or spacing.
- Spacing points interpolate continuously from `spacingLow` at zero shooting to `spacingHigh` at a spacing rating of 10, capped beyond that. Defense is `110 + defenseScale * (coachedDefense - 110)`.
- Depth is `depthScale * reserveFRF`; fatigue retains `-8 + 7 * reserveFRF` on back-to-backs. Home advantage, sigmoid width, opponent pool, schedules and score rules remain unchanged.

Fits store parameters, bounds, starting points, search method, source hashes and per-roster outputs. Fit 4 prioritizes bands using a 0.05-win interior selection margin and paired-coordinate search; it does not widen acceptance bands. Baseline/usage/spacing outputs remain reproducible through explicit CLI modes. Earlier fit algorithms are described here and in their reports; the current `fit` command runs the latest search, not all historical variants.

```powershell
node --experimental-strip-types src/engine/calibrate-rosters.ts NEW_BASELINE.json baseline
node --experimental-strip-types src/engine/calibrate-rosters.ts NEW_USAGE.json usage
node --experimental-strip-types src/engine/calibrate-rosters.ts NEW_SPACING.json spacing
node --experimental-strip-types src/engine/calibrate-rosters.ts NEW_FIT.json fit
node --experimental-strip-types src/engine/calibrate-rosters.ts NEW_STRESS.json stress docs/research/mid-iq/MID_IQ_ROSTER_FIT_14.json NEW_SEED_PREFIX
node --experimental-strip-types src/engine/calibrate-rosters.ts NEW_AUDIT.json audit docs/research/mid-iq/MID_IQ_ROSTER_FIT_14.json
node --experimental-strip-types src/engine/calibrate-rosters.ts NEW_POSITION_CONTROL.json position-stress docs/research/mid-iq/MID_IQ_ROSTER_FIT_14.json NEW_SEED_PREFIX
node --experimental-strip-types src/engine/calibrate-rosters.ts NEW_POLICY_STUDY.json policy-stress docs/research/mid-iq/MID_IQ_ROSTER_FIT_14.json NEW_SEED_PREFIX 100
node --experimental-strip-types src/engine/calibrate-rosters.ts NEW_ACCESS_STUDY.json access-stress docs/research/mid-iq/MID_IQ_ROSTER_FIT_14.json NEW_SEED_PREFIX 100
node --experimental-strip-types src/engine/calibrate-rosters.ts NEW_COACH_AUDIT.json coach-audit docs/research/mid-iq/MID_IQ_ROSTER_FIT_14.json
```

Output paths must be new: the evaluator refuses to overwrite retained evidence. Stress and audit verify the frozen candidate implementation, catalog, math and opponent hashes. Earlier reports whose implementation hashes differ are deliberately rejected by these commands; regression tests replay their numerical evaluations without falsely claiming unchanged source. There is deliberately no validation-family evaluation mode yet; those outcomes must not be exposed by a default run.

## Continuation (2026-09-15)

### Full-Pool Expectations

The 64 schedules remain useful for conditional season distributions, but their sample average is no longer sufficient for a band pass. From fit 11 onward, optimization uses the full opponent pool: each tier contributes its scheduled game count, opponents are uniform within tier, home probability is 1/2, and back-to-back frequency is 14/82. These marginals follow the independent schedule streams. This gives an analytical expected-win total, not an assumption that all schedule contexts are independent. Qualification probabilities still mix exact conditional distributions over the 64 schedules.

Reports now distinguish `inBand`/`passed` (sampled schedule expectation) from `poolInBand`/`poolPassed` (full-pool expectation). Both use unrounded numbers. For example, [fit 10's audit](MID_IQ_ROSTER_AUDIT_10.json) exposes F04 at 40.02 despite a 39.95 sample mean; [fit 13's audit](MID_IQ_ROSTER_AUDIT_13.json) rejects C07 at 68.00312585095745 despite displaying 68.00. No acceptance band was widened.

### Model Experiments

| Experiment | Sample Bands | Pool Bands | Finding |
| --- | ---: | ---: | --- |
| [Fit 5](MID_IQ_ROSTER_FIT_5.json) | 12/15 | Not measured | Remove flat pace quality; independent creation |
| [Fit 6](MID_IQ_ROSTER_FIT_6.json) | 15/15 | Not measured | Shared creation clears bands; coaching too weak and Nelson always last |
| [Fit 7](MID_IQ_ROSTER_FIT_7.json) | 15/15 | Not measured | Positive tempo-style fit, no role cost |
| [Fit 8](MID_IQ_ROSTER_FIT_8.json) | 15/15 | Not measured | Fixed role cost; later set aside because the motivating control was confounded |
| [Fit 9](MID_IQ_ROSTER_FIT_9.json) | 13/15 | Not measured | Stronger coaching with role cost |
| [Fit 10](MID_IQ_ROSTER_FIT_10.json) | 15/15 | Audit fails | Warm-start refinement; sample boundary passes do not survive full-pool audit |
| [Fit 11](MID_IQ_ROSTER_FIT_11.json) | 11/15 | 11/15 | Full-pool fitting, role cost disabled, stronger positive-style coaching |
| [Fit 12](MID_IQ_ROSTER_FIT_12.json) | 15/15 | 15/15 | Symmetric relative tempo fit; all upgrade checks pass but coach bias remains |
| [Fit 13](MID_IQ_ROSTER_FIT_13.json) | 13/15 | 12/15 | Direct made-three coaching improves some choices but over-favors Kerr and increases optimized success |

These are development searches, not independent validation attempts. Fits 6-13 use shared creation: score-only contributions retain the all-five/top-three/top-two blend, while assists enter as 0.6 times the best creator plus 0.4 times the five-player mean. Every starter still has positive marginal scoring and passing value in the tested cases. Congestion, continuous spacing and reserve usage separation remain as in the first cycle.

Three tempo alternatives are retained explicitly for reproducibility. `neutral` removes pace as quality. `style` gives fast systems a bonus based on normalized passing/steals and slow systems a bonus based on top-two scoring, both capped at one; its unopposed slow-coach bonus helped Brown dominate. `relative-style` instead uses signed pace times coach scale times (transition fit minus half-court fit). It is symmetric, and synthetic checks confirm that coach preference changes with roster strengths. These are modeling hypotheses, not measured historical coach effects.

Fit 13's optional `made-shots` model uses normalized starter three-point attempts times the clamped percentage change times three points, scaled by coach influence. It does not simultaneously apply that percentage boost to spacing. Tests cover positive/negative boosts, zero attempts, normalization and percentage limits. This avoids one accounting omission but does not establish that shooting and defensive coach effects are now balanced. Earlier modes remain reproducible; the live engine does not use any of them.

Fit 12 is the strongest role-neutral band fit, not a release candidate. Its full-pool reference roster expectation is 61.42, reserve Horford adds 2.314 wins, young Kobe costs 2.050, and the Duncan/Towns swap changes nothing. Fit 13 misses C07 (68.003126), C10 (63.954948) and E03 (74.029485). Its corresponding Horford gain is 3.920 and young-Kobe loss is 0.814. These misses remain failures despite their small size.

### Position-Control Correction

[Position stress 1](MID_IQ_ROSTER_POSITION_STRESS_1.json) is retained as **confounded evidence**: `primary-greedy` accidentally selected with the released objective while unrestricted greedy used the candidate. Its 47% versus 95% realized qualification comparison cannot isolate position effects and must not justify a new role penalty.

The corrected [position stress 2](MID_IQ_ROSTER_POSITION_STRESS_2.json) records objectives explicitly and uses frozen fit 10 with the same seeds as [stress 4](MID_IQ_ROSTER_STRESS_4.json). Both greedy policies now optimize the candidate: unrestricted mean qualification probability is 96.88% (97/100 realized), primary-only is 94.12% (92/100). Neither primary-preferring policy needed a secondary-position fallback. This is a policy comparison within the role-cost candidate, not an isolated estimate of the role penalty's effect.

The supposed large positional exploit was not supported. Fits 11-13 fix `rolePenalty` at zero. The optional historical role-cost mode remains only to reproduce earlier experiments; no eligibility or live positional rule changed.

### Coach and Challenge Findings

| Report / Candidate | Random Median Expected Wins | Rating Median | Candidate-Greedy Median | Greedy Mean Qualification | Greedy Realized |
| --- | ---: | ---: | ---: | ---: | ---: |
| [Stress 2 / fit 6](MID_IQ_ROSTER_STRESS_2.json) | 39.49 | 63.50 | 71.19 | 97.76% | 95/100 |
| [Stress 3 / fit 8](MID_IQ_ROSTER_STRESS_3.json) | 32.62 | 61.33 | 68.47 | 92.35% | 93/100 |
| [Stress 4 / fit 10](MID_IQ_ROSTER_STRESS_4.json) | 36.74 | 62.98 | 69.74 | 96.88% | 97/100 |
| [Stress 5 / fit 12](MID_IQ_ROSTER_STRESS_5.json) | 37.37 | 63.94 | 69.42 | 95.94% | 92/100 |
| [Stress 6 / fit 13](MID_IQ_ROSTER_STRESS_6.json) | 38.64 | 64.52 | 70.93 | 97.94% | 98/100 |

All six standard stress reports contain 400 legal replay-verified runs each; the two position reports contain 400 each. These 3,200 executions are not 3,200 independent seeds: policies are paired, position controls reuse seeds, and stress 6 intentionally shares stress 5's prefix. No rerolls or optimized coach choices were used. Random/rating/released-greedy lineups reproduce across stress 5/6; candidate-greedy choices may change with the objective, so that comparison includes both selection and evaluation effects.

Fit 12 coach spreads range from 1.08 to 4.73 wins. The best coach varies among Brown, Daly, Jackson and Popovich, but Nelson is worst on 14/15 rosters. Fit 13 reduces that uniform last-place problem, yet Kerr is best on 11/15; spreads range from 1.17 to 5.28. Neither is convincing evidence that knowledgeable players have balanced contextual coach choices. The agreed 2-4 range describes typical contrasts, not an invented mandatory threshold for every pair.

Initial-roll accessibility was inspected without changing draft rules: 180 franchise/decade combinations, 4,411 stored versions, and 25 player choices at the 10th/50th/90th percentiles of roll size. Best available displayed ratings have 10th/50th/90th percentiles 45.5/53.9/67, versus a pool-wide 90th percentile of 44.4. These descriptive figures follow `rollOptions` and the stored pool. They suggest that choosing talent from broad historical menus deserves further scrutiny; they do not prove that access alone causes high success or authorize reducing player availability.

### Continuation Verdict

No candidate clears the combined review. Fit 12 demonstrates that the approved roster bands and upgrade directions are achievable without positional costs; fit 13 reveals a coach-accounting tradeoff, not a successful replacement. Optimized qualification remains near-certain in these simulations. There is still no measured human engagement, playoff or title result and no approved numerical human-success target.

Keep the nine reserved families untouched. The next useful experiment should compare realistic selection policies and roll accessibility at fixed roster quality, and review coach effects in comparable statistical units. Do not hide the problem through weaker player-version ratings, a renewed positional tax, arbitrary qualification changes, or more coefficient searches solely to convert rounded near misses into passes.

## Decision Consistency and Access (2026-09-15)

### Fixed-Model Policy Study

[Policy study 1](MID_IQ_ROSTER_POLICY_STRESS_1.json) holds fit 13 fixed and runs six policies on 100 paired seeds each. The new top-three policies choose uniformly among three distinct players, each in its best-ranked legal slot. Rating-top-three uses displayed rating, while candidate-top-three uses the exact candidate objective. They do not approximate measured human behavior, and rating tie-breaking still follows the deterministic slot order. No rerolls or coach optimization are used.

| Policy | Median Expected Wins | Mean Qualification Probability | Mean 65+ Probability | Mean 75+ Probability |
| --- | ---: | ---: | ---: | ---: |
| Random legal choice | 38.35 | 2.70% | 0.53% | 0.00013% |
| Highest rating | 64.74 | 76.39% | 50.90% | 4.18% |
| Primary-position highest rating | 63.39 | 71.95% | 46.23% | 3.54% |
| Random among top-three ratings | 59.51 | 51.14% | 25.47% | 0.97% |
| Random among model top three | 64.98 | 81.43% | 54.49% | 3.28% |
| Exact model greedy | 70.65 | 97.39% | 88.21% | 18.78% |

This qualifies the earlier challenge warning: a high exact-model qualification rate does not by itself show that ordinary drafting, first-seed pursuit or the full game is easy. The same model yields only 51% qualification under a modest change in selection consistency. Conversely, these synthetic policies do not prove that the experience is engaging. Regular-season qualification is not a title or a 98-0 outcome; postseason behavior remains unverified.

### Choice-Breadth Counterfactual

[Access study 1](MID_IQ_ROSTER_ACCESS_STRESS_1.json) uses the same fit 13 and seeds. It restricts this experiment's choices to three or eight uniformly ranked, distinct legal players from the current franchise/decade roll. The unrestricted controls reproduce policy study 1's players, actions, coaches, evaluations and outcomes exactly. Menus are logged, contain every selected player, and always permit a legal pick. Changing a pick can change subsequent legal roll options, so this is a paired policy intervention, not a guarantee of identical later menus.

| Objective | Full-Menu Qualification | Eight-Player Menu | Three-Player Menu |
| --- | ---: | ---: | ---: |
| Highest displayed rating | 76.39% | 42.82% | 14.96% |
| Exact model greedy | 97.39% | 75.26% | 27.78% |

Relative to full menus, eight-player menus reduce expected wins by 6.49 for rating selection (approximate paired 95% interval: -7.80 to -5.17) and 6.87 for model greedy (-7.71 to -6.03). Three-player menus reduce them by 14.15 and 15.88 respectively. Intervals use per-seed differences, not games as independent samples, and do not include model uncertainty.

**Recommendation: retain current player access.** Choice breadth is a demonstrated difficulty lever at fixed roster quality, but restricting access would materially alter iconic-player availability and the draft experience. These results do not authorize changing live menus, rerolls, eligibility, player ratings or qualification thresholds. A restrictive-menu mode would be a separate design decision, not a silent balance fix.

### Comparable Coach Effects

[Coach unit audit 1](MID_IQ_COACH_UNIT_AUDIT_1.json) measures isolated modifier probes on development rosters under fit 13. Its made-three coaching enters offense directly, while defensive coaching was multiplied by the fitted roster-defense coefficient. For example, a +0.3 DBPM probe usually adds about 0.452 neutral rating points including reserve benefit; +0.03 three-point percentage adds 0.550-1.885 depending on attempts. Different doses are explicit, and equal percentage changes are not assumed to have equal basketball value.

[Fit 14](MID_IQ_ROSTER_FIT_14.json) tests a direct defensive-coach effect: apply `defenseScale` to uncoached roster defense, then add the coached-minus-uncoached defensive change times `coachScale`. No additional numerical parameter or coach-ID adjustment is fitted. Historical `scaled` mode remains available for replay. A unit test verifies that the direct coaching effect does not vary with roster-defense scaling and that uncoached evaluation is unchanged.

Fit 14 passes **14/15 full-pool bands and 13/15 sample bands**. C02's full-pool expectation remains just below 64 (displayed as 63.99); F01 also falls below 64 in the sampled schedules but passes in the full pool. All upgrade gates pass: pool Horford +3.927, young Kobe -1.024 and PF/C swap zero. [Fit 15](MID_IQ_ROSTER_FIT_15.json), a verified same-mechanism warm start, returns the exact same parameters and loss. The miss is not rounded into a pass.

[Stress 7](MID_IQ_ROSTER_STRESS_7.json) evaluates all coaches and 400 fresh legal drafts under fit 14. Best-coach counts are Spoelstra 4, Kerr 4, Brown 3, Popovich 3 and Daly 1, compared with Kerr 11/15 in fit 13. This improves choice diversity but is not a clean coach validation: Nelson is worst on 12/15, and best-to-worst ranges are 1.61-5.98 wins, with large C01/F04 contrasts. Greedy qualification is 97.90% in expectation and 100/100 realized; that realized result is not a population certainty.

### Fresh Policy Confirmation

[Policy study 2](MID_IQ_ROSTER_POLICY_STRESS_2.json) freezes fit 14 and uses a fresh seed prefix, with another 600 replay-verified drafts. It confirms the qualitative decision-consistency pattern without assuming that fit 13's results transfer unchanged:

| Policy | Median Expected Wins | Mean Qualification Probability | Mean 75+ Probability |
| --- | ---: | ---: | ---: |
| Random legal choice | 37.85 | 2.14% | 0.000019% |
| Highest rating | 63.98 | 75.42% | 3.03% |
| Primary-position highest rating | 65.21 | 74.66% | 3.49% |
| Random among top-three ratings | 57.97 | 44.64% | 0.64% |
| Random among model top three | 64.19 | 78.39% | 3.13% |
| Exact model greedy | 70.02 | 95.43% | 16.77% |

Within these paired seeds, rating-top-three loses 5.45 expected wins versus highest rating (approximate 95% interval: -6.68 to -4.23); candidate-top-three loses 5.62 versus exact greedy (-6.40 to -4.84). Selection consistency matters substantially. These findings support separating roster plausibility, draft difficulty and high-end achievement rather than treating 60-win qualification as the only challenge metric.

### Verdict After Fit 15 (Historical)

No release: fit 14/15 still misses an approved band and has coach outliers. No reserved-family performance has been computed. The live season-3 engine, old saves, data, draft rules, score model and UI are unchanged. Do not continue warming the same stalled optimizer or weaken accepted rosters merely to lower expert qualification rates. The next decision is how to resolve contextual coaching and its remaining roster-fit conflict while preserving the established bands; actual human playtesting remains necessary for engagement claims.

The new cycle adds 2,200 report executions: two 600-run policy studies, one 600-run access study and the 400-run stress 7. Reused controls and paired policies are not independent seeds. A small optional seed count (2-10,000, default 100) supports focused CLI regression tests; the full evidence studies use 100 per policy.

## Reserved Evaluation Protocol (Frozen Before Measurement)

Selection on 2026-09-15: freeze [fit 18](MID_IQ_ROSTER_FIT_18.json), including its parameters and candidate/catalog/math/opponent hashes, after [stress 9](MID_IQ_ROSTER_STRESS_9.json). Fit 18 passes all 15 full-pool expected-win bands and every approved upgrade check. Its two below-band sample means are finite-schedule estimates, not the full-pool expectations used for acceptance. No approved band is widened or rounded.

The system-coach correction removes the coach-driven change in player-liability penalties without changing the uncoached roster penalty. [Fit 16](MID_IQ_ROSTER_FIT_16.json) retains fit 14's assigned-coach benchmark results, while [stress 8](MID_IQ_ROSTER_STRESS_8.json) reduces C01/F04 coach spreads to 3.62/3.50. [Fit 17](MID_IQ_ROSTER_FIT_17.json) tests coupled parameter moves but still misses C02. Fit 18 instead prioritizes actual feasibility ahead of the old 0.05-win interior preference, with a 0.0001-win lookup guard; final band checks remain exact. This is a selection-objective correction, not a new basketball coefficient.

The frozen coach review has five different winning coaches and a 1.61-4.06 win spread. Nelson's 12/15 last-place finishes and some sub-two-win contrasts remain explicit risks, not proof of perfect coach parity. They do not introduce a new numerical coach-ranking gate. Draft selection studies remain synthetic; high greedy qualification alone is not a human-engagement failure criterion.

Reserved protocol: measure C04, C08, C09, C11, C12, E01, E06, F05 and F06 without fitting, using full-pool expected-win bands plus conditional distributions over 256 fresh schedules with prefix `mid-iq-rosters-validation-1-`. Any full-pool band miss is a failed validation and blocks release. Record the fit-file hash in the output and refuse overwrites. Once measured, these families are exposed; subsequent retuning cannot be called fresh validation against them. A passing numerical result would still require versioned live integration, old-save compatibility, build and browser checks before release.

## Next Experiment Boundary

The frozen [validation report](MID_IQ_ROSTER_VALIDATION_1.json) is **FAIL: 4/9 full-pool bands**, also 4/9 sampled means. Source fit SHA-256: `3e5fb3e9fe3de32b5f6c7a59871465c2df3dc555ab0cde55d719b46c4a23bc2b`. All parameters were fixed before measurement. The CLI returned exit code 1 after preserving the failed report.

| Reserved Roster | Approved Band | Full-Pool Expected Wins | Result |
| --- | ---: | ---: | --- |
| C04: Detroit defense | 64-68 | 55.327986 | Fail |
| C08: Curry/Thompson/Green | 64-68 | 70.446610 | Fail |
| C09: Magic/Kareem support | 64-68 | 61.179864 | Fail |
| C11: Jokic support | 64-68 | 69.374905 | Fail |
| C12: Boston balance | 64-68 | 66.357683 | Pass |
| E01: Curry/Durant | 69-74 | 74.022899 | Fail |
| E06: LeBron/Garnett/Jokic | 69-74 | 73.121310 | Pass |
| F05: limited offense | 35-44 | 38.088053 | Pass |
| F06: historic star stack | 69-74 | 73.668636 | Pass |

Displayed values are shortened; the report and gates use unrounded numbers, including E01's 0.022899-win miss. C04 is 8.672014 below its minimum and C09 is 2.820136 below, while C08 and C11 exceed their maxima. This is a generalization failure, not just schedule sampling or an optimizer boundary issue. A uniform strength shift cannot repair both directions. The evidence does not by itself establish which basketball mechanism is missing.

Fresh stress 9 adds 400 legal drafts: mean qualification probability is 2.74% random, 75.34% rating-led, 65.71% released-model greedy and 97.54% candidate greedy; the latter reaches 75+ with 14.59% probability. Stress 8 and 9 add 800 retained draft executions, including paired seeds in stress 8, not 800 independent observations. These remain synthetic challenge diagnostics and do not override failed roster validation.

Stop tuning this candidate for release. The exposed families may inform diagnosis, but a subsequent model needs independently approved, unmeasured validation families before another generalization claim. The CLI permits only the original fit-file hash when replaying this reserved set; it rejects changed fits before evaluation. Keep full draft menus, qualification thresholds and stored player versions unchanged. A future passing candidate still needs versioned engine integration, old-save compatibility, UI preview agreement, full tests/build and browser verification. No production release is made here.

## Post-Validation Diagnosis (No Retuning)

[Diagnosis 1](MID_IQ_ROSTER_DIAGNOSIS_1.json) uses the exact exposed fit 18 and all 24 previously measured bases. The new `diagnose` mode in [the evaluator](../../../src/engine/calibrate-rosters.ts) requires the original fit-file hash and verifies the validation's model, math, catalog and opponent hashes. Every neutral evaluation and full-pool expectation must replay before output. It neither searches parameters nor creates a release candidate. Original reports, model implementation and approved bands remain unchanged.

The diagnostic ledger sums baseline, scoring, creation, congestion loss, coach shooting, spacing, roster defense, coach defense, reserve and pace exactly to neutral rating. Inverting the full-pool expectation gives the following uniform rating shifts needed to reach the nearest approved boundary, holding reserve fatigue fixed:

| Miss | Required Rating Shift | Diagnostic Contrast |
| --- | ---: | --- |
| C04 | +5.991440 | Versus C03, scoring contributes -6.213 rating while roster defense compensates by only +1.403 |
| C08 | -2.480303 | Removing spacing alone lowers 70.45 to 64.21 wins; removing the extra top-two blend lowers it to 67.97 |
| C09 | +2.115568 | Its spacing term is -2.123161 rating; removing that term alone raises 61.18 to 64.01 wins |
| C11 | -1.349394 | Removing spacing alone lowers 69.37 to 65.92 wins; removing the extra top-two blend lowers it to 66.58 |
| E01 | -0.034175 | Small but still an exact failed band; it does not explain the other large misses |

These are model counterfactuals, not player substitutions, historical causal effects or approved fixes. Term-removal win differences are nonlinear and must not be added. The shooting-coach ledger term covers coach-driven made threes; FG% coaching is already included in the scoring term. This is an algebraic breakdown, not a complete causal attribution of each coach. The source JSON retains full-precision inversions.

### Findings and Limits

1. **Scoring concentration is compounded.** [The core aggregation](../../../src/engine/math.ts#L12) already blends all-five and top-three means. [The candidate](../../../src/engine/roster-balance.ts) then blends that result with the top-two mean at weight 0.8. Within each ordered scoring pool, effective rank weights are 46.133%, 46.133%, 6.133%, 0.8% and 0.8%, before the common offense/congestion scaling. Coach-induced rank changes can mix different orderings. This is weighting of the `points * FG%` input, not possession shares or each player's percentage of total offense. It makes distributed scoring difficult to represent. However, removing only the extra top-two blend worsens Detroit to 53.85 wins and passes just 14/24 bands, versus the frozen model's 19/24. Concentration alone is not the complete explanation.

2. **A defensive-scale increase is not a solution.** Fit 18 retains 42.21% of uncoached defensive deviation from 110. Restoring 100% puts C04 at 65.75 wins, but passes only 1/24 approved bands. C04 and F05 receive almost identical uncoached roster-defense credit (5.414881 versus 5.443979 rating). Both use Ben Wallace at center; the [defense formula](../../../src/engine/math.ts#L92) gives the best big the rim term and lets the second big contribute only through the team mean, while Prince's stored DBPM is 0.1. This identifies limited differentiation in the estimator, not proof that a stored stat is erroneous or that every reputed defender should get a manual bonus. These are player-version composites, not literal historical team seasons.

3. **Spacing has disproportionate explanatory power in several misses, but cannot simply be removed.** [Spacing input](../../../src/engine/math.ts#L125) is raw three-point attempts times percentage, summed across starters. It does not distinguish five credible threats from concentrated production, or shooting gravity from made-shot value. Fit 18 turns that into a fixed additive term and separately adds coach-driven made threes. C08 and C12 both saturate at +5.744361 spacing despite different lineups; C08 also gets +1.923658 more coach-shooting rating than C12. Neutralizing spacing passes only 11/24 bands. A replacement must distinguish shot value, shooter distribution and coaching effects rather than stack unconditional rewards.

4. **The current inputs cannot identify possession efficiency.** `points * FG%` applies an additional accuracy reward to points already scored; assists add creation without turnover cost, and per-game volume is not minutes-adjusted. [PlayerStats](../../../src/engine/types.ts#L4) lacks minutes, field-goal/free-throw attempts and turnovers. The raw per-game CSV already has those columns, and the advanced CSV has true shooting and turnover percentage. Header availability is verified; complete historical coverage, aggregation weights and multi-team joins are not. The model should not infer unavailable values as zero or silently replace the selected peak years.

### Next Model Boundary

Prioritize an offline possession-budget prototype: separate offensive opportunity, shot efficiency and turnover cost; allow creation to redistribute opportunities rather than add scoring without a cost. Preserve positive talent upgrades and keep raw shooting value distinct from any bounded lineup-spacing effect. This requires a source-data completeness and aggregation audit before implementation; it is not justified by changing the existing constants alone.

For defense, first evaluate whether available measures can distinguish rim protection, perimeter coverage and collective support without repeatedly rewarding the same box-score events. Evidence beyond the current box scores may be necessary. Do not add Detroit-specific chemistry, coach-ID corrections or retrospective player overrides to make the failed band pass. The approved expectations may be underdetermined by the present input schema; a richer model is a hypothesis to test, not a promised solution.

The 24 exposed bases remain regression/diagnostic cases. Once the next model's structure and data policy are settled, obtain approval for genuinely new, unmeasured roster families and freeze their expectations before performance measurement. Do not relabel these nine families as independent validation. Live balance, menus, scores, saves and processed data stay unchanged throughout this diagnostic stage.

Reproduce the diagnosis to a new path:

```powershell
node --experimental-strip-types src/engine/calibrate-rosters.ts NEW_DIAGNOSIS.json diagnose docs/research/mid-iq/MID_IQ_ROSTER_FIT_18.json
```

The CLI regression covers exact reconciliation, inverse-band ordering, term-removal arithmetic, rejection of an altered fit and refusal to overwrite. There is no optimizer, fresh schedule sample or new benchmark measurement in this diagnostic mode.

## Possession Inputs and Accounting Prototype

The next stage completed [a source audit](MID_IQ_POSSESSION_INPUT_AUDIT_1.json) and [an unfitted accounting report](MID_IQ_POSSESSION_PROTOTYPE_1.json). This supersedes the earlier header-only coverage observation, not the failed fit-18 verdict. No new roster expectations or win measurements were introduced.

### Peak-Preserving Data Audit

[The audit script](../../../scripts/data_pipeline/audit_possessions.py) invokes the existing importer functions without their file-writing entry point. All **4,411 stored player objects reproduce exactly**, including peak years, rounded stats, positions and ordering. The audit then joins those same selected records to the raw CSVs by player, franchise, season and raw team for advanced stats. No ambiguous peak rows, repeated peak seasons or missing/duplicate selected advanced joins were found. Multi-team aggregate rows are excluded, matching the importer. Source files and importer dependencies are hashed and unchanged after the run.

| Decade | Stored Versions | Complete Core Offensive Inputs |
| --- | ---: | ---: |
| 1960s | 297 | 0 |
| 1970s | 537 | 120 |
| 1980s | 602 | 602 |
| 1990s | 725 | 725 |
| 2000s | 750 | 750 |
| 2010s | 750 | 750 |
| 2020s | 750 | 750 |
| Total | 4,411 | 3,697 |

**714 versions lack turnover observations in at least one selected peak record.** The audit records 1,424 missing selected turnover-field occurrences and 982 missing offensive-rebound occurrences; these are selected-record occurrences, not a count of independent players. Missing values stay `null`, including partial peak coverage. A recorded zero stays zero. Pre-1980 three-point attempts/makes alone use structural zero because the NBA had no three-point shot. No historical turnover proxy or alternate peak years were substituted.

Twenty-two of the 24 exposed six-player rosters have complete core fields. E05 is blocked by Milwaukee Kareem; F06 by Boston Russell, Philadelphia Chamberlain and Milwaukee Kareem. Thus a turnover-dependent replacement cannot currently cover the full game or all approved benchmarks.

For new inputs, pool each selected season's `games * per-game statistic`, then divide by pooled `games * minutes per game` to obtain per-36 rates. Efficiency ratios use pooled counts, not averaged percentages. This preserves the selected player versions but intentionally differs from the existing importer's minute-weighted average of per-game statistics; the new rates live only in the audit, never in the stored player objects. Rounded CSV rates imply approximate rather than exact season totals. Advanced true shooting is retained with source-row provenance, not averaged or used to fill missing data.

### Prototype Contract

[The pure prototype](../../../src/engine/possession-prototype.ts) defines an approximate used offensive event as `FGA + 0.44 * FTA + TOV`. For five starters it allocates exactly 100 events, using each player's share of observed per-36 demand by default. Each allocation produces shot events, turnover events and points at that player's pooled rates. An explicit five-share input is also supported; the retained report compares an equal-share allocation without optimizing either policy.

This fixes accounting, not basketball balance: allocations sum to 100, shot plus turnover events reconcile, improved scoring at fixed opportunities increases output, and additional turnovers reduce output in the tested fixed-input cases. No raw point total is multiplied by FG% again, and no assist bonus creates extra events. Missing, negative and non-finite required inputs are rejected. Each roster requires complete core data for all six selected versions even though this first calculation evaluates only its five starters.

| Example | Points per 100 Used Events | Turnover Events per 100 |
| --- | ---: | ---: |
| C04: Detroit defense | 96.665 | 10.759 |
| C09: Magic/Kareem support | 103.384 | 14.004 |
| C11: Jokic support | 107.926 | 11.199 |
| F03: Wade/Kidd defense | 89.565 | 16.376 |
| F05: limited offense | 97.735 | 11.069 |

**These are not offensive ratings, expected wins or new band results.** Offensive rebounds and precise free-throw sequences are absent from the event count. Era-relative efficiency, opportunity capacity, load-efficiency tradeoffs, assisted-shot redistribution, spacing, coaching, defense, reserve minutes and fatigue remain unimplemented. F05's slightly higher event efficiency than C04 is a useful warning: efficiency alone cannot establish the ability to generate enough good offense. Higher shot volume alone may lower the weighted output when it reallocates demand toward a less efficient player. This is not a complete positive-talent-value model.

### Verification and Remaining Gate

The Python self-check exercises pooled exposure, missing versus zero and invalid numeric input. TypeScript independently reconstructs every audit aggregate, checks the original peak-points average against the stored rounded value, and verifies missing-turnover propagation. Cross-runtime sums use the existing 1e-10 tolerance; identifiers, peak years and missing values are exact checks. Prototype tests cover event conservation, scoring/turnover direction, scaling and permutation invariance, explicit allocations and unsupported input rejection. The CLI rejects stale source hashes and existing output paths, records the input-audit hash and marks E05/F06 unsupported rather than estimating them.

Reproduction commands, all outputs new paths:

```powershell
python scripts/data_pipeline/audit_possessions.py --self-test
python scripts/data_pipeline/audit_possessions.py NEW_INPUT_AUDIT.json
node --experimental-strip-types src/engine/calibrate-rosters.ts NEW_ACCOUNTING.json possession NEW_INPUT_AUDIT.json
```

The verified runtime was system Python 3.14.3; use the configured interpreter if `python` points elsewhere. The scripts require no new packages. The original importer, processed data, frozen fit/validation, production engine and saves remain untouched.

The next model gate is **historical coverage and identifiable offensive capacity**, not fitting these efficiency outputs to the exposed win bands. Any historical imputation would need a separately documented uncertainty policy; missing turnovers must not silently become zero. Era baselines and load/creation assumptions need independent evidence before converting this accounting into a team-strength model. The full historical replacement remains blocked, while the covered-data accounting prototype is complete. New unmeasured validation families should be approved only after that model/data policy is settled, with expectations frozen before measurement.

## Season-Relative Baseline Audit

[Era baseline audit 1](MID_IQ_ERA_BASELINE_AUDIT_1.json), produced by [the season-context audit](../../../scripts/data_pipeline/audit_era_baselines.py), covers every year used by the frozen peaks: **67 seasons, 1960-2026**. All 4,411 player versions have shooting, shot-workload and assist-rate comparisons. Turnover comparisons remain available for 3,697 versions; complete NBA player-turnover coverage in these sources begins in 1978. No fit, win prediction, changed player version or new validation family is involved.

### Reference Population

For each season, pool every positive-games NBA player-team stint, including low-minute players and franchises outside the current draft pool. Apply no peak-selection or rotation cutoff to this reference population. Exclude `TOT` and `nTM` aggregate rows so traded players' minutes are not counted both in their stints and their combined row; 2,656 aggregate rows are excluded. Duplicate season/player/raw-team keys are rejected.

Per-game rates are converted to approximate totals with games played, then pooled. League efficiency uses shot-event denominators, not an arithmetic average of player percentages or team rates. Any missing field makes that season's dependent metric unavailable rather than computing a selected complete-case baseline. The existing input audit and its dependencies are hash-verified before use.

The raw team summaries contain a non-team `League Average` row. An initial strict team-set check caught it in 1960 before output; that explicitly identified summary row is excluded. Actual team sets now match in every season. Pooled player minutes divided by `240 * sum(team wins + losses)` range from 1.001945 to 1.009157. The small excess is consistent with overtime and rounded per-game rates, but is not an exact completeness or possession proof. Team summaries contain turnover rates for all teams as early as 1971 and partial coverage in 1969-70; those rates cannot identify individual turnovers and are not used to fill them.

| Season | Pooled True-Shooting Proxy | Shot Events per 36 Player Minutes | Player Turnover Share |
| --- | ---: | ---: | ---: |
| 1960 | 46.35% | 18.594 | Unavailable |
| 1970 | 51.08% | 17.019 | Unavailable |
| 1980 | 53.12% | 15.321 | 15.32% |
| 1990 | 53.66% | 14.863 | 13.53% |
| 2000 | 52.27% | 13.898 | 13.77% |
| 2010 | 54.29% | 13.779 | 12.78% |
| 2020 | 56.45% | 14.743 | 12.33% |
| 2026 | 58.16% | 14.834 | 12.19% |

Shot events are `FGA + 0.44 * FTA`; turnover share is `TOV / (shot events + TOV)`. These are approximate player-event measures, not possession counts or published team turnover percentages. Season labels and data are those of the frozen local source, not a fresh external historical verification. All precision-sensitive calculations retain unrounded values in the report.

### Exposure-Weighted Comparisons

Each selected peak season is compared with its own season baseline before pooling. The expected points are that player's shot events times the corresponding league points-per-shot-event rate. The **shot-efficiency ratio** is observed points divided by those expected points. The **true-shooting delta** is the observed-minus-expected points divided by twice the player's pooled shot events; it is a percentage-point difference, not a relative percentage gain.

For workload, expected shot events are selected minutes times the same-season league shot-event rate per player minute. The **shot-workload ratio** is observed shot events divided by this expectation. Assist and used-event workload ratios use analogous minute exposure. Turnover comparison instead weights the season's turnover share by the player's observed used events. Any unsupported selected season makes the whole peak turnover comparison unavailable; no partial-peak averaging is allowed.

| Stored Version | Shot-Efficiency Ratio | TS Delta (Percentage Points) | Shot-Workload Ratio |
| --- | ---: | ---: | ---: |
| Billups, Detroit 2000s | 1.126 | +6.771 | 1.098 |
| Fisher, Lakers 2000s | 1.028 | +1.472 | 0.915 |
| Curry, Warriors 2010s | 1.190 | +10.213 | 1.514 |
| Magic, Lakers 1980s | 1.126 | +6.789 | 1.140 |
| Jokic, Denver 2020s | 1.141 | +8.139 | 1.455 |
| Kareem, Milwaukee 1970s | 1.163 | +8.163 | 1.352 |
| Russell, Boston 1960s | 0.986 | -0.675 | 0.770 |

These comparisons describe different dimensions; they are not a player ranking. A workload ratio of 1.5 means 50% more shot events per minute than the season-weighted league reference, not a 50% usage rate or proven ability to maintain efficiency under a new role. League means include the evaluated player, so this is descriptive context rather than independent prediction. Assist activity is not credited as extra points. Kareem and Russell retain shooting/workload comparisons while their turnover comparisons remain null.

### Outcome and Next Gate

**Era-context inputs are now available, but they are not wired into the accounting prototype or live game.** The audit establishes that absolute shooting and workload rates vary with season and provides a reproducible way to describe selected peaks relative to those seasons. It does not prove that skills transfer unchanged across eras, nor that a simple normalization fixes the exposed roster failures.

The next model task is to test offensive capacity and load-efficiency assumptions using observed season-level data, separate from the 24 exposed roster bands. Start with the complete-turnover period and distinguish observed workload from any claimed maximum. Changes within the same player over seasons are still confounded by age, teammates, injuries and selection; do not describe an association as a causal load penalty. Before extending that model to pre-1978 peaks, evaluate historical-turnover estimation with masked observed data and explicit uncertainty. No roster-specific adjustment, alternate peak selection or silent imputation is authorized by this audit.

Reproduce to a new path using the configured Python interpreter:

```powershell
python scripts/data_pipeline/audit_era_baselines.py --self-test
python scripts/data_pipeline/audit_era_baselines.py NEW_ERA_AUDIT.json
```

This run used the workspace `.venv` Python 3.14.3 selected by the environment tool. Synthetic self-checks cover neutral season comparisons, shot-versus-minute weighting and missing-versus-zero turnovers. The engine regression independently reconstructs all 67 baseline rates and all 4,411 relative peak comparisons, and verifies source and implementation hashes. A report refuses overwrites. No existing audit, frozen fit, processed data, player schema, balance rule or save was changed.

## Observed Workload and Efficiency

[Workload study 1](MID_IQ_WORKLOAD_STUDY_1.json) tests the next assumption using observed NBA player seasons, not the exposed roster bands. [The study script](../../../scripts/data_pipeline/audit_workload.py) verifies the frozen era-baseline report and all upstream source hashes. Its protocol was fixed before running the data. It produces descriptive associations only: **no fitted game coefficient, capacity ceiling, new win estimate or validation claim**.

### Fixed Protocol

- Use 1978-2026, the complete-player-turnover period, with at least 20 games and 500 minutes in each included player-season. Pool all NBA team stints for a player-season once, excluding aggregate rows. No draft-pool or peak selection is applied.
- Compare season-relative shot-workload ratio with true-shooting delta and turnover-share delta. Each row receives equal weight; a repeated player is a cluster for uncertainty estimation.
- Compare cross-sectional player-seasons, consecutive-season changes, same-single-team consecutive changes, and a stable subset. Stable means the same single raw team label, ages 20-34 in both years and after/before minutes-per-game ratio between 0.8 and 1.2 inclusive.
- Fit a descriptive OLS line with an intercept. Report player-cluster CR1 standard errors and normal 1.96 intervals. These account for dependence within players, not every shared team or season shock.
- Inspect the stable subset separately in 1978-1999, 2000-2012 and 2013-2026, requiring both years of a pair inside its period. Also report fixed workload-change groups at -0.2 and +0.2. These are sensitivity checks, not separate independent validations.

The retained data contain **15,082 player-seasons from 2,537 players** and **11,775 consecutive pairs from 1,989 players**. The script excludes 2,393 aggregate rows and 6,033 low-exposure player-seasons. No otherwise eligible incomplete player-season was encountered in this period. Season observations retain raw CSV line references; pairs retain both season keys. Actual team renames conservatively remove cases from the same-team subset rather than being guessed as continuity.

### Shooting Result

Effect units below are percentage points of true-shooting delta per **+0.25 in the season-relative shot-workload ratio**. This is neither +25 percentage points of usage nor necessarily a 25% increase in that player's prior workload.

| Comparison | Observations | Players | TS Association | Approximate 95% Interval |
| --- | ---: | ---: | ---: | ---: |
| Across player-seasons | 15,082 | 2,537 | +0.441 | +0.294 to +0.588 |
| Consecutive changes | 11,775 | 1,989 | -0.063 | -0.210 to +0.085 |
| Same-team changes | 7,543 | 1,785 | -0.075 | -0.257 to +0.107 |
| Stable changes | 5,054 | 1,486 | -0.100 | -0.302 to +0.103 |

The positive cross-sectional association does not show that adding workload improves a player's efficiency; more capable players can receive more shots. Within-player changes remove stable player-level differences, but their shooting estimates are near zero and all listed intervals include both signs. The stable shooting regression explains about 0.020% of the variation in shooting changes. This does not establish that workload has no effect, only that this observational design provides little support for a strong universal penalty.

| Stable Era Check | Pairs | TS Association | Approximate 95% Interval |
| --- | ---: | ---: | ---: |
| 1978-1999 | 2,046 | -0.071 | -0.384 to +0.243 |
| 2000-2012 | 1,265 | +0.087 | -0.327 to +0.502 |
| 2013-2026 | 1,560 | -0.247 | -0.609 to +0.114 |

Signs vary across periods and every interval includes zero. These era counts exclude 183 stable pairs crossing a period boundary; they are not a complete partition of the full stable cohort. Fixed directional groups contain 233 substantial decreases, 4,523 smaller changes and 298 substantial increases. Their unadjusted means are retained in the report; they do not override the regression uncertainty or establish a response curve.

### Turnover Denominator Check

The stable turnover-share association is **-1.539 percentage points**, with an approximate interval of **-1.676 to -1.401**, per +0.25 workload-ratio change. That must not become a rule that more shooting improves ball security: `TOV / (FGA + 0.44 * FTA + TOV)` declines mechanically when shots rise, even if turnovers per minute stay fixed.

After inspecting that result, an explicitly **post-hoc arithmetic control** holds each player's prior turnovers per 36 fixed, substitutes the following season's observed shots per 36, and recomputes the change in season-relative turnover share. Its stable-cohort slope is **-2.818 percentage points** per +0.25 workload change. This is a deterministic sensitivity calculation, reproduced in the regression test, not another fitted behavioral model or a causal decomposition. It demonstrates that the denominator alone can produce a substantial negative association; neither slope estimates a ball-security benefit. A future turnover model should predict counts or rates with offensive exposure and role controls rather than interpreting this share slope as skill.

### Decision and Limits

**Do not introduce a new steep universal congestion curve from this study.** No coefficient has been promoted into either prototype or live math. Retain the distinction between observed efficiency, observed workload and sustainable capacity. Cross-player associations cannot identify an individual's response to extra responsibility, and the within-player results do not identify a maximum load.

The stable filter does not hold teammates, injuries, play types, shot quality, coaching or age effects constant. Inclusion in both seasons selects players who maintain enough exposure. Measurement error and shared shot-event denominators, regression to the mean, league-reference uncertainty and team/season shocks remain. Neither the normal intervals nor the multiple comparisons are independent causal or confirmatory evidence. This study cannot validate behavior for five high-usage stars playing together outside observed individual workloads.

The next useful modeling test is predictive rather than another fit to roster expectations: evaluate whether observed workload, efficiency and creation-related inputs improve out-of-player and forward-season prediction over simple season-context baselines. A capacity rule needs that evidence or an explicit game-design assumption and sensitivity range; it must not be presented as empirically established by these slopes. Historical-turnover estimation remains a separate masked-data/uncertainty task before pre-1978 support. All 24 approved roster families remain exposed development evidence, not fresh validation.

Reproduce to a new path:

```powershell
python scripts/data_pipeline/audit_workload.py --self-test
python scripts/data_pipeline/audit_workload.py NEW_WORKLOAD_STUDY.json
```

Python self-checks cover slope arithmetic, clustered residuals, consecutive pairing and stable-subset boundaries. The engine regression independently reconstructs every pair and all four cohort/two-outcome regressions, clustered intervals, era splits, directional means and the post-hoc denominator control. Source hashes and original data remain unchanged. No new package, production rule, save schema or benchmark expectation was introduced.

## Next-Season Offensive Prediction

[Prediction study 1](MID_IQ_OFFENSE_PREDICTION_1.json), generated by [predict_offense.py](../../../scripts/data_pipeline/predict_offense.py), tests whether the observed offensive inputs add predictive value beyond a player's own previous outcome. This is an offline diagnostic, **not a capacity model or a release candidate**. The fixed protocol was written and synthetic leakage checks passed before real-data evaluation. These seasons had already been inspected in descriptive studies, so the evaluation partitions are new but the underlying data are not wholly untouched.

### Protocol and Isolation

Use all 11,775 consecutive pairs from workload study 1, retaining its minimum 20 games and 500 minutes in both seasons. Features come only from the immediately prior season. No target-season minutes, team, workload, efficiency or assists enter the predictors. Player identity selects the partition but is not a predictor. No hyperparameters or model definitions were changed after evaluation.

The held-out player partition is `int(SHA256(UTF8(playerId)), 16) % 5 == 0`. Training target seasons end in 2012. Each split fits its own models once; none is updated using later seasons.

| Evaluation | Training Pairs | Training Players | Test Pairs | Test Players |
| --- | ---: | ---: | ---: | ---: |
| Unseen players, target years through 2012 | 6,118 | 1,071 | 1,696 | 288 |
| Future target seasons, 2013-2026 | 7,814 | 1,359 | 3,961 | 873 |
| Unseen players in future target seasons | 6,118 | 1,071 | 743 | 176 |

The first and third splits exclude all held-out identities from training. The future-season split allows returning players, as a temporal prediction task should. "Unseen" means unseen by the fitted model, not a rookie without prior observations. The splits overlap and are not three independent replications.

Two outcomes are evaluated: next-season TS proxy minus next-season league TS proxy, and next-season turnovers per 36 minus next-season league turnovers per 36. Future league context defines the evaluation labels only. This is a prediction of relative performance, not a forecast of future league conditions or raw statistics. League aggregates include the evaluation players, as shared reference data; they are not leave-player-out baselines.

The six fixed models are a training-outcome mean; context-only regression; literal persistence of the prior outcome; context plus prior outcome; context plus prior workload, shooting and turnover rate; and that profile plus prior season-relative assists per 36. Context means prior age, age squared, minutes per game and games played. Assists are a passing proxy, not an identified measure of teammate shot creation. Turnovers use a per-minute rate, not the previously confounded share of shot-plus-turnover events.

Regressions use training-only population standardization and ridge alpha 1 with an unpenalized intercept, solved by NumPy's augmented least-squares routine. The retained report includes feature rows, target values, exact partition indices, training means/scales, coefficients and every held-out prediction. Equal-pair RMSE and MAE are reported. Predeclared incremental comparisons also report paired MSE differences with player-cluster normal intervals; those intervals do not account for every shared team/season shock or multiple comparisons.

### Held-Out Results

Shooting RMSE below is in **TS percentage points**. Turnover RMSE is in **turnovers per 36 minutes**. Lower is better; the units cannot be compared across outcomes. The simpler mean/context models and MAE results remain in the full report.

| Outcome / Split | Persistence | Context + Prior Outcome | Offensive Profile | Profile + Assists |
| --- | ---: | ---: | ---: | ---: |
| Shooting / unseen players | 4.004 | 3.597 | 3.593 | 3.598 |
| Shooting / future seasons | 4.342 | 3.858 | 3.860 | 3.852 |
| Shooting / unseen future players | 4.143 | 3.773 | 3.778 | 3.768 |
| Turnovers / unseen players | 0.4343 | 0.4033 | 0.4025 | 0.3958 |
| Turnovers / future seasons | 0.4547 | 0.4340 | 0.4328 | 0.4282 |
| Turnovers / unseen future players | 0.4442 | 0.4235 | 0.4237 | 0.4190 |

Most shooting improvement comes from conditioning on the previous outcome rather than adding the broader profile. The profile-minus-prior-outcome MSE intervals include zero in all three splits. Adding assists to the profile slightly worsens shooting RMSE for unseen pre-2013 players. It improves the two future splits by only about 0.008 and 0.011 TS percentage points of RMSE, although their unadjusted paired intervals exclude zero. This is not compelling support for a universal shooting or congestion correction.

Assists provide a modest, more consistent improvement in **turnover-rate prediction**, reducing profile RMSE by about 1-2% in each split. The predeclared paired MSE differences are:

| Profile + Assists Minus Profile | MSE Difference | Approximate 95% Interval |
| --- | ---: | ---: |
| Unseen players | -0.005366 | -0.008846 to -0.001886 |
| Future seasons | -0.003924 | -0.005574 to -0.002274 |
| Unseen future players | -0.003954 | -0.007280 to -0.000628 |

These differences are in squared turnover-rate units, not percentage points or a causal assist benefit. Future-era sensitivity checks split evaluation targets into 2013-2019 and 2020-2026. Adding assists improves turnover RMSE in both periods for both future evaluation splits; the full future split contains 1,955 and 2,006 pairs, and the unseen-future split 386 and 357. No model was refit for these checks.

### Modeling Decision

Retain separate workload, efficiency, passing and turnover inputs for subsequent offline modeling. Prior performance supplies substantial predictive information, while passing adds modest turnover-prediction information after those controls. Do not transplant these next-season regression coefficients directly into a three-year-peak lineup rating: the targets, aggregation and deployment task differ.

**No capacity ceiling, causal workload response or teammate creation bonus is established.** This task does not even forecast next-season workload: prior workload is an input, not a maximum-capacity label. Both-season eligibility selects survivors and excludes dropout prediction. Assists can encode role and turnover opportunity rather than a protective skill. Linear forecasts are unconstrained diagnostic estimates, not production-safe stat generators. Season-relative error reduction does not demonstrate historical portability before 1978, five-star lineup compatibility, win-band fit or draft engagement.

The next implementation can use these findings as constraints for a conservative offline lineup model: keep observed shot allocation distinct from sustainable capacity, model turnover exposure explicitly, and label any beyond-observed workload limit as a game-design assumption with sensitivity checks. The empirical work supports neither a steep universal penalty nor unlimited efficient usage. Such a model still needs lineup-level evidence and fresh user-approved roster families before release. Production remains season-3 / mid-iq-2 / conditional-score-3, and all 24 existing benchmark families remain exposed development evidence.

### Reproduction

The analysis adds NumPy only to the workspace Python environment, not the application dependencies. [requirements-analysis.txt](../../../scripts/data_pipeline/requirements-analysis.txt) specifies the compatible range; the frozen report records Python 3.14.3 and NumPy 2.5.3. Use that exact environment for byte-identical replay. Older audits and their hash-pinned writers remain unchanged.

```powershell
& './.venv/Scripts/python.exe' -m pip install numpy==2.5.3
& './.venv/Scripts/python.exe' scripts/data_pipeline/predict_offense.py --self-test
& './.venv/Scripts/python.exe' scripts/data_pipeline/predict_offense.py NEW_OFFENSE_PREDICTION.json
```

Synthetic checks cover the solver, ridge shrinkage, constant-feature handling, partition isolation and invariance of fits/predictions to changed held-out labels. Independent engine checks reproduce partition membership, lagged feature timing, training-only scaling, ridge normal equations, every prediction, RMSE/MAE, paired clustered intervals and era summaries. A separate CSV reconstruction verifies all added assist/turnover features and turnover labels for all 11,775 pairs. The writer pins upstream sources and refuses to overwrite an existing report.

## Offline Lineup Allocation Model

[Lineup prototype 1](MID_IQ_LINEUP_PROTOTYPE_1.json) implements explicit era-relative shot allocation and turnover accounting in [lineup-prototype.ts](../../../src/engine/lineup-prototype.ts). [calibrate-lineups.ts](../../../src/engine/calibrate-lineups.ts) consumes the frozen possession and era audits without changing their writers, player peaks or production data. This replaces no existing model: the earlier accounting prototype, fit18 and live rules remain intact.

### Accounting Rules

Each of five equal-time starters begins with one fifth of a 100-event reference budget. Events mean `FGA + 0.44 * FTA + TOV`, not true possessions. For reference turnover share `t`, a player's observed shot exposure is `20 * (1 - t) * shotWorkloadRatio`; observed turnover exposure is `20 * t * turnoverRateRatio`. The new turnover ratio is pooled selected-peak turnovers divided by the sum of selected minutes times each season's league turnovers per minute. It is not turnover share, and missing peak turnovers remain null.

Shot efficiency is transported as `referencePointsPerShotEnd + 2 * trueShootingDelta`. This preserves an additive TS difference from the selected seasons; portability to a common reference environment is an assumption, not an established fact. No efficiency reward or penalty is applied when workload changes. The workload multiplier is allocated shots divided by observed shots, explicitly exposing expansion or compression.

For a design response parameter `r`, player turnover cost is:

```text
turnovers = observedTurnovers * ((1 - r) + r * allocatedShots / observedShots)
```

At zero, turnover exposure stays fixed as shots change; at one, it scales proportionally with allocated shots. Neither endpoint nor the midpoint is fitted or identified causally. The allocator deducts fixed turnover costs and accounts for marginal shot-linked turnover costs while distributing shots in requested proportions. It redistributes to remaining positive-weight players when an assumed cap binds. Zero requested weights stay zero; this is not an efficiency-maximizing shot selector.

A finite capacity multiplier caps shots at a multiple of observed shot exposure. An uncapped case permits arbitrary expansion and reports its size. If total eligible capacity cannot use the event budget, the result is `capacity-shortfall`, with **unallocated events kept separate from shots and turnovers**. Points on allocated events in a shortfall are not a complete-team score and must not be ranked against fully allocated lineups. Even fully allocated results are not ORTG or projected wins.

Passing remains visible in each player ledger. The predictive study does not justify a causal assist bonus or transferring next-season regression coefficients to peak lineups, so neither is included. Defense, spacing, coaching, reserves, fatigue, offensive rebounds and opponent effects remain outside this offensive allocation model.

### Fixed Sensitivity Grid

The grid was fixed before evaluating rosters: reference seasons 1990, 2010 and 2020; turnover responses 0, 0.5 and 1; capacity multipliers unlimited, 1, 1.25 and 1.5; observed-demand and equal-shot allocation. This yields **72 scenarios per supported roster**, with no fitted policy selection, band acceptance or win estimates. Reference 2020, observed demand, fixed turnover exposure and unlimited capacity are used only to display a consistent example, not as a recommended policy.

All 4,411 player versions retain their original peaks. **3,697 are supported**, as in the prior audits. The grid covers **30 of 32 bases and variants: 22 bases plus all eight variants, totaling 2,160 scenarios**. E05 and F06 remain unsupported because of historical missing turnovers. All six roster members must have complete inputs, consistent with earlier audits, although only five starters contribute to this model.

### What the Grid Exposes

The following uncapped, observed-demand, 2020-reference examples change only the turnover response. These are accounting sensitivities, not offensive rankings or confidence intervals.

| Roster | Points, Fixed TOV Rate | Points, Shot-Linked TOV | Fixed TOV Events | Linked TOV Events | Fixed-Rate Workload Multiplier |
| --- | ---: | ---: | ---: | ---: | ---: |
| C01 | 100.897 | 102.885 | 13.146 | 11.434 | 0.853 |
| C04 | 103.349 | 103.079 | 9.742 | 9.979 | 1.027 |
| E02 | 102.099 | 107.806 | 15.445 | 10.719 | 0.657 |
| F01 | 94.798 | 105.042 | 21.019 | 12.483 | 0.536 |
| F03 | 96.691 | 95.979 | 14.646 | 15.274 | 1.051 |
| F05 | 107.399 | 104.294 | 7.540 | 10.213 | 1.395 |
| V03 | 106.883 | 102.391 | 9.032 | 12.855 | 1.486 |

F01's turnover-response assumption alone changes allocated points by about 10.24. Compressing shooting responsibility does not establish how much passing, handling and turnover exposure disappears. That unanswered role question matters more than choosing a precise capacity multiplier from this grid.

F05's uncapped fixed-rate case requires about 39.5% more shooting workload than observed; V03 requires about 48.6%. Their seemingly efficient output therefore relies on unverified expansion. In the 2020 observed-demand scenarios, the capacity shortfall sets are identical across the three turnover responses:

- At 1.0 capacity: C03, C04, F03, F05 and V03 leave unresolved events.
- At 1.25 capacity: F05 and V03 remain unresolved. Under fixed turnover exposure their gaps are 9.603 and 14.435 events respectively.
- At 1.5 capacity: all supported rosters fill the budget. This is **not** evidence that a 1.5 cap is correct; it is only where this grid stops exposing aggregate shortfalls.

Equal-shot allocation can require much larger individual expansion even when total roster capacity is ample. For example, C01's uncapped maximum player multiplier is 1.775 under equal shares versus 0.853 under observed-demand shares. The model records this rather than silently treating both allocations as equally plausible basketball behavior.

### Decision and Next Gate

Keep this model offline. It makes the hidden workload and turnover assumptions inspectable, but does not establish positive talent value, sustainable capacity, shot creation or five-player strength. Coach-only, reserve-only and PF/C-label variants can be unchanged by construction; this is not a pass of their full-game upgrade gates. All existing roster families remain exposed development evidence.

The next useful evidence is how individual shot and turnover rates change when offensive roles actually compress or expand, ideally around roster/teammate changes with explicit confounding checks. A future rule must separate shooting from passing/handling exposure instead of treating every turnover as either wholly fixed or wholly shot-linked. Any capacity policy still needs an explicit game-design rationale and sensitivity disclosure. Do not pick the 1.5 cap simply because it fills every roster, tune shortfalls to old win bands, or convert unresolved events into a fabricated penalty. Lineup-level validation and fresh user-approved families remain required before release.

Reproduce to a new path:

```powershell
node --experimental-strip-types src/engine/calibrate-lineups.ts NEW_LINEUP_PROTOTYPE.json
node --experimental-strip-types --test --test-name-pattern='lineup study|offline lineup allocation' src/engine/math.test.ts
```

Verification covers hand-calculated neutral cases, a 1,440-case synthetic policy sweep, zero-share behavior, capped redistribution, monotonic point/turnover checks, input immutability, permutation invariance and nonfinite-input rejection. Independent retained-report checks reconstruct all peak turnover ratios and all 2,160 scenario ledgers, including proportional allocation among uncapped players and complete saturation when a shortfall remains. CLI regression checks exact byte replay and overwrite rejection. No new dependency, live rule, save schema, UI or benchmark expectation is introduced in this stage.

## Observed Offensive Role Changes

[Role-change study 1](MID_IQ_ROLE_CHANGE_STUDY_1.json), generated by [audit_role_changes.py](../../../scripts/data_pipeline/audit_role_changes.py), examines how shooting, passing and turnovers move together between player seasons. It does not change the lineup prototype or select a turnover-response parameter. The cohort, models, thresholds and comparisons were fixed before measuring results.

### Fixed Comparisons

Reuse all 11,775 consecutive pairs from workload study 1, with at least 20 games and 500 minutes in each season. Pool raw team stints once per player-season and reconstruct shot events (`FGA + 0.44 * FTA`), assists and turnovers per 36 minutes. Subtract each season's own league rate before differencing. These are differences in rates, not percentage changes or turnover shares. Both seasons' raw rates and CSV references are retained for each pair.

The descriptive model is OLS with an intercept, shot-rate change and assist-rate change. Each pair receives equal weight. Player-cluster CR1 covariance supplies approximate normal 95% intervals. Four predeclared cohorts are reported: all pairs, same-single-team pairs, the earlier stable same-team subset, and changed-single-team pairs with stable exposure. Stable exposure means ages 20-34 in both years and after/prior minutes-per-game ratio between 0.8 and 1.2 inclusive. Raw team-label changes can include renames; this is not a controlled teammate intervention.

| Cohort | Pairs | Players | Shot-Change Slope | Approximate 95% Interval | Assist-Change Slope | Approximate 95% Interval |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| All consecutive pairs | 11,775 | 1,989 | 0.0666 | 0.0623 to 0.0709 | 0.1790 | 0.1680 to 0.1900 |
| Same single team | 7,543 | 1,785 | 0.0635 | 0.0582 to 0.0688 | 0.1810 | 0.1674 to 0.1947 |
| Stable same team | 5,054 | 1,486 | 0.0654 | 0.0593 to 0.0715 | 0.1932 | 0.1778 to 0.2086 |
| Changed single team, stable exposure | 1,070 | 736 | 0.0777 | 0.0659 to 0.0896 | 0.1831 | 0.1526 to 0.2136 |

Each slope is associated turnover change per 36 for a one-unit change in its season-relative predictor rate, holding the other predictor change constant in the regression. It is **not** a causal turnover cost per shot or assist, an elasticity, or the lineup prototype's response parameter. The fitted intercept is retained; it is not silently forced to zero. These descriptive fits do not include the contextual controls used in the conditional evaluations below.

Stable-cohort era checks retain positive shot and assist associations in all three periods. Shot slopes are 0.0588, 0.0628 and 0.0760 for 1978-1999, 2000-2012 and 2013-2026; assist slopes are 0.1804, 0.1973 and 0.1955. All six unadjusted intervals exclude zero. Both years must fall in the period, so 183 stable pairs crossing a period boundary are excluded from these checks. These are overlapping diagnostic views, not independent confirmations.

### Directional Checks

Within the stable cohort, substantial changes are fixed at at least 2 shot events per 36 or 1 assist per 36 in either direction, after season adjustment. All nine cells are retained below. Values are mean turnover-rate changes; parentheses show pair counts, not independent player counts. Small cells and unadjusted means cannot identify a response curve.

| Shot Change | Assists Decreased | Assists Similar | Assists Increased |
| --- | ---: | ---: | ---: |
| Decreased | -0.6255 (31) | -0.2468 (490) | -0.0149 (58) |
| Similar | -0.3026 (244) | -0.0217 (3,284) | +0.2817 (299) |
| Increased | -0.2304 (57) | +0.1520 (507) | +0.5138 (84) |

Shot increases with assist decreases are associated with lower, not higher, turnover rates in this small cell. Shot decreases with assist increases are near unchanged. That pattern warns against assuming every turnover rises or falls in direct proportion to shooting responsibility.

### Conditional Evaluation

Five models are compared on the same already-exposed player/time partitions as prediction study 1. Training targets end in 2012, and held-out identities use the same fixed SHA256 partition. There is no tuning or refitting after evaluation. **These models intentionally observe after-season shot, assist and minutes changes. They are conditional estimates, not preseason forecasts.** Their errors are not directly comparable to the prior lag-only forecasting task.

- Fixed turnovers: hold raw prior turnovers per 36 constant, then subtract the actual league turnover-rate change to obtain a relative-change prediction.
- Shot-linked turnovers: scale raw prior turnovers per 36 by the observed after/prior raw shot-rate ratio, then subtract the league-rate change.
- Context: prior season-relative shot, assist and turnover rates, prior age, and observed minutes-per-game change.
- Context + shots: add observed season-relative shot-rate change.
- Context + shots + assists: also add observed season-relative assist-rate change.

Regressions reuse training-only standardization and fixed ridge alpha 1 with an unpenalized intercept. Prior turnover controls can capture regression to the mean; improvement over a fixed-rate baseline must not all be attributed to role changes. The incremental comparisons isolate the added measured inputs within this model class, not causal mechanisms.

| Evaluation | Fixed Turnovers | Shot-Linked Turnovers | Context | Context + Shots | Context + Shots + Assists |
| --- | ---: | ---: | ---: | ---: | ---: |
| Unseen players through 2012 | 0.4425 | 0.4827 | 0.3983 | 0.3838 | 0.3621 |
| Future seasons, 2013-2026 | 0.4582 | 0.4342 | 0.4310 | 0.3887 | 0.3455 |
| Unseen future players | 0.4457 | 0.3929 | 0.4193 | 0.3653 | 0.3259 |

RMSE is in turnovers per 36 minutes. The split train/test pair counts remain 6,118/1,696; 7,814/3,961; and 6,118/743. Shot-linked exposure performs worse than fixed exposure on the pre-2013 unseen-player split but better on the future splits. Neither endpoint is a universally adequate rule.

Adding assist changes after shot changes reduces conditional RMSE by about 5.7%, 11.1% and 10.8%. The paired MSE differences are negative across all three splits:

| Shots + Assists Minus Shots | MSE Difference | Approximate 95% Interval |
| --- | ---: | ---: |
| Unseen players | -0.016198 | -0.022024 to -0.010371 |
| Future seasons | -0.031741 | -0.036179 to -0.027303 |
| Unseen future players | -0.027192 | -0.035184 to -0.019200 |

Adding shot changes to context also reduces MSE with intervals below zero in all three partitions. All intervals are equal-pair, player-cluster normal approximations without multiple-comparison adjustment. Shared team/season shocks are not fully accounted for, the evaluation splits overlap, and both their identities and source seasons were exposed earlier. This is diagnostic reuse, not fresh validation.

### Role-Change Modeling Decision

The evidence supports treating **shooting exposure and passing/handling exposure as separate modeling inputs**. It does not support labeling more assists as protective ball security: rising assists can reflect more handling opportunities and more turnovers. Recorded assists omit many passes and depend on teammate shot conversion, so they are not a complete handling-volume measure.

Do not replace the prototype's turnover response with these descriptive slopes or pick a universal fixed/shot-linked endpoint. No assist-allocation or teammate-creation mechanism has been established for a hypothetical lineup, and the conditional evaluation obtains those changes from observed seasons. It cannot generate them for a roster of historical stars. Capacity ceilings and efficiency under expanded workload remain unidentified.

The next bounded modeling step can separate shot-linked and passing-related turnover exposure as an explicit offline design sensitivity, with a conserved passing opportunity budget and no causal claim for its coefficients. It must show how compressing shooting while retaining a lead-passing role differs from compressing both roles, and must not optimize to exposed win bands. Before release, that mechanism still needs lineup-level evidence, historical missing-data policy and fresh approved roster families.

Remaining limitations include common per-minute denominators, rounded rate error, role selection, teammate and coach changes, injuries, aging, and survival through both seasons' exposure filters. The team-change subset is not a natural experiment and no teammate treatment variable was constructed. This study changes no lineup policy, live rule, player peak, save schema or win expectation.

Reproduce in the existing Python 3.14.3 / NumPy 2.5.3 analysis environment to a new path:

```powershell
& './.venv/Scripts/python.exe' scripts/data_pipeline/audit_role_changes.py --self-test
& './.venv/Scripts/python.exe' scripts/data_pipeline/audit_role_changes.py NEW_ROLE_CHANGE_STUDY.json
```

Synthetic checks cover known multivariate coefficients, clustered covariance, directional thresholds and held-out target isolation. Independent engine checks reconstruct rate changes, cohorts, OLS normal equations and the covariance sandwich identity, evaluation splits, ridge optimality, predictions, RMSE/MAE and paired uncertainty. Direct CSV reconstruction verifies both seasons' rates for all 11,775 pairs, representing 14,064 distinct player-seasons. The report pins upstream writers and inputs, retains every observation and prediction, and refuses existing output paths. No new dependency was added.

## Separate Shooting and Passing Allocation

[Dual-role allocation study 1](MID_IQ_ROLE_ALLOCATION_1.json) adds a separate passing-responsibility budget in [role-allocation.ts](../../../src/engine/role-allocation.ts), with an immutable report generated by [calibrate-roles.ts](../../../src/engine/calibrate-roles.ts). It consumes the frozen lineup inputs and pins the role-change evidence chain. It does not edit either prior model, import empirical slopes as game coefficients, or replace live balance.

### Dual Budget Rules

The model maintains two distinct accounting identities:

```text
allocated shots + fixed/shot-linked/passing-linked turnovers + unresolved events = 100
allocated passing responsibility + unresolved passing responsibility = 100
```

Passing responsibility units are **not passes, made assists, possessions or shots**. They are a synthetic role scale: each equal-time player's nominal observed exposure is `20 * assistRateRatio`. The 100-unit target is a design assumption and is not tied to shot conversion. No passing unit creates points, and a player's passing allocation is not added to their shot allocation. This avoids double-counting offense but does not establish how many assists a hypothetical lineup would generate.

Nominal shots, nominal turnovers and transported shooting efficiency remain as in lineup prototype 1. For nonnegative fractions whose sum is at most one:

```text
fixedFraction = 1 - shotFraction - passingFraction
shotMultiplier = allocated shots / observed nominal shots
passingMultiplier = allocated passing units / observed nominal passing units
turnovers = observed nominal turnovers *
(fixedFraction + shotFraction * shotMultiplier + passingFraction * passingMultiplier)
points = allocated shots * transported points per shot end
```

The fractions partition observed turnover exposure; the model never adds a full extra passing-turnover cost on top of full shot-linked turnovers. None of these fractions is estimated from the role-change regression. Assist rates are imperfect proxies for role demand, not independently identified passing or ball-security skill.

Passing responsibility is allocated first in requested proportions, capped if requested, with overflow redistributed among remaining positive-weight players. Fixed and passing-linked turnover costs are then deducted from the event budget. Shots are allocated from the remainder with marginal shot-linked turnover costs included. This is a sequential allocation assumption, not a jointly optimized offense. Zero requested shares remain zero.

The model reports separate shot and passing capacities, requested shares, allocations, expansion multipliers and three turnover components for each player. Either unresolved budget makes the result `role-shortfall`. Missing passing responsibility can reduce estimated turnovers and therefore leave more room for shots; **that incomplete result is not a strength improvement and must not be ranked as a complete offense**. Nothing fabricates a penalty or fills the gap. Uncapped results can still require implausible expansion, which remains visible.

Zero observed assists do not authorize extrapolating a passing-linked turnover rate. A player with zero assists and positive passing-linked nominal turnover cost is explicitly unsupported for that policy. If nominal turnover cost is zero, zero observed passing receives zero capacity and a null expansion multiplier. Invalid fractions, capacities, shares, nonfinite costs and negative available event budgets are rejected rather than clamped into plausible-looking output.

### Fixed Dual-Role Grid

The study fixes the reference year at 2020 and crosses these predeclared choices:

- Four turnover splits: shot-only `(1, 0)`; half-fixed `(0.5, 0)`; split-roles `(0.5, 0.5)`; mixed-fixed `(0.25, 0.5)`. Pairs are shot and passing fractions; the remainder stays fixed.
- Five capacity pairs: uncapped both; shots capped at 1.25 with passing uncapped; passing capped at 1.25 with shots uncapped; both capped at 1.25; both capped at 1.5.
- Three requested allocations: observed demand for both roles; observed shots with half the passing budget assigned to the largest assist-rate player; equal shots with observed passing demand.

For the half-budget passer case, the other four divide the remaining half in proportion to their assist-rate ratios. Lexical player ID resolves ties. This is an explicit role perturbation, not an efficiency optimizer; half can be less than a player's original demand share. A binding cap can reduce the final allocation below the requested half.

The grid produces **60 cases per supported roster, 1,800 evaluated scenarios across 30 bases and variants**. E05 and F06 retain their historical missing-data exclusions. No additional zero-passing-exposure scenario is blocked among these supported rosters. All six members must have complete source inputs, but only the five starters contribute. This limited reference-year grid does not establish era robustness, full roster strength or capacity correctness.

### Separate Role Behavior

A hand-calculated neutral fixture makes the separation explicit. Each player begins with 2.4 nominal turnover events and a half-shot/half-passing turnover split. A player reduced to half their observed shot workload while retaining twice their nominal passing responsibility has `2.4 * (0.5 * 0.5 + 0.5 * 2) = 3.0` turnover events. Compressing both roles to half produces `1.2`. In the uniform fixture, another player's role changes offset those costs, so total scoring remains identical: moving passing responsibility does not manufacture points.

The following real-roster examples use the split-roles turnover policy, no caps, observed shot demand, and either observed or half-budget lead-passer allocation. These are design sensitivities, **not rankings or projected offensive ratings**.

| Roster | Observed-Role Points | Half-Lead Points | Observed-Role TOV | Half-Lead TOV | Observed Shot Expansion | Observed Passing Expansion |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| C01 | 101.447 | 102.023 | 12.672 | 12.177 | 0.858 | 1.070 |
| E02 | 108.960 | 109.476 | 9.763 | 9.336 | 0.701 | 0.563 |
| F01 | 105.417 | 105.697 | 12.171 | 11.938 | 0.596 | 0.562 |
| F05 | 103.979 | 104.580 | 10.484 | 9.967 | 1.350 | 1.431 |
| V03 | 104.143 | 104.235 | 11.364 | 11.286 | 1.448 | 1.069 |

Under observed-role allocation, each role's expansion is uniform across players because allocation follows its own nominal demand. Under explicit allocations, per-player multipliers can differ substantially. In C01, the designated passer's passing multiplier rises from 1.070 to 1.409 and their own turnover events rise from 2.952 to 3.478, even though total lineup turnovers fall. Reallocation changes who incurs costs; lower team cost is not evidence that more passing protects the designated player from turnovers.

F05's designated passer needs a 2.175 passing multiplier under the uncapped half-budget assignment. Thus its modest apparent point improvement relies on much greater unverified individual passing expansion. The prototype does not infer that the player can sustain it.

With observed allocations and split-role turnover fractions, cap diagnostics distinguish the limitations:

| Capacity Pair | Shot Shortfalls | Passing Shortfalls |
| --- | --- | --- |
| Uncapped | None | None |
| Shots 1.25, passing uncapped | F05, V03 | None |
| Passing 1.25, shots uncapped | None | F05 |
| Both 1.25 | F05, V03 | F05 |
| Both 1.5 | None | None |

At both-1.25, F05 leaves 7.718 unresolved events and 12.619 unresolved passing units. V03 leaves 12.996 unresolved events but fills its passing budget. The quantities have different units and must not be added together. Filling both budgets at 1.5 is not evidence that 1.5 is the correct capacity rule.

### Dual-Role Decision

The offline model now distinguishes a player who takes fewer shots while remaining a lead passer from one whose responsibilities fall in both roles. It also prevents passing roles from being unlimited or free without exposing that assumption. **No turnover split, passing allocation or capacity multiplier has been selected for production.** The passing scale, fixed target and assist-based nominal demand remain design assumptions, and rates can encode teammates, role selection and shot conversion rather than portable skill.

The next useful gate is empirical team/lineup-level validation of the joint budgets and role allocation, not another fit to the exposed roster win bands. In particular, check whether a fixed passing-responsibility target and transported player costs reproduce observed team turnover accounting before treating hypothetical historical lineups as comparable. These checks need to distinguish errors in the synthetic passing scale from errors in allocation and player rates. Full-game defense, spacing, reserves, coaching, fatigue, historical missing data and fresh approved validation families remain unresolved release requirements.

Reproduce to a new path:

```powershell
node --experimental-strip-types src/engine/calibrate-roles.ts NEW_ROLE_ALLOCATION.json
node --experimental-strip-types --test --test-name-pattern='dual role' src/engine/math.test.ts
```

Verification includes neutral and retained-lead-role examples, zero shares/exposure, independent cap redistribution, invalid-input rejection, 576 synthetic policy cases with permutation checks, and equivalence to the frozen event model when passing-linked turnovers are disabled. Independent checks reconstruct all 1,800 scenario ledgers, nominal rates, explicit lead shares, capacity bounds and proportional allocation conditions. Exact model replay uses the retained explicit shares; independently reconstructed shares use the existing numeric tolerance because summation order can change final floating-point bits. CLI checks require byte-identical report replay and overwrite rejection. No new dependency, production rule, existing audit writer, player peak, UI or save schema changes in this stage.

## Team-Season Turnover Gate

[Team-role study 1](MID_IQ_TEAM_ROLE_STUDY_1.json), generated by [audit_team_roles.py](../../../scripts/data_pipeline/audit_team_roles.py), checks the turnover accounting against historical team-season aggregates. This is the first team-level diagnostic of the separate budgets, not a production calibration or a validation of five-player lineups. No coefficients are fitted and no capacity, allocation or turnover split is selected from these results.

### Lagged Team Inputs

The study includes **1,336 NBA team-seasons from 1979 through 2026**, using every positive-minute team stint rather than the draft pool or a selected starting five. Previous-year player seasons pool all NBA stints, excluding TOT/nTM aggregate rows. A player's prior rates qualify at 20 games and 500 minutes; actual next-year team minutes determine their exposure weight. Thus even the prior-role case is conditional on the observed rotation, **not a preseason forecast**.

All reference rates come from the previous league season. Target turnovers are used only as labels, never in transported player rates, reference turnover shares, role allocations or passing budgets. A current season's outcomes can legitimately become the next season's lagged inputs; target-isolation checks hold the particular case's prior inputs fixed.

Players without qualifying prior exposure receive an explicit **modeled league-average fallback**, not a filled-in historical record. Their target minutes remain in the team budget and their fallback reason is retained. The study reports all teams and a predeclared cohort with at least 90% of target minutes covered by qualifying prior rates. The latter still permits up to 10% fallback exposure and is not a random sample of teams. This fallback is confined to this diagnostic and does not change player peaks, missing historical turnover records or the prior roster exclusions.

Five positive-game stints have zero recorded minutes and zero shots, assists and turnovers. They are listed separately and contribute nothing to target allocation; their games remain in prior-season eligibility totals. A zero-minute row with nonzero counts would fail the audit rather than be silently discarded.

For each player, let `weight` be their share of target team minutes and `q` the previous league turnover share. Nominal exposures generalize the earlier five-equal-player model:

```text
nominal shots = 100 * weight * (1-q) * prior shots/min / prior league shots/min
nominal turnovers = 100 * weight * q * prior TOV/min / prior league TOV/min
nominal passing = 100 * weight * prior AST/min / prior league AST/min
```

The four previously declared turnover splits are unchanged: shot-only, half-fixed, split-roles and mixed-fixed. Each is evaluated without capacity caps under three allocation diagnostics:

- **Prior roles:** nominal exposures determine both requested shares; passing budget remains 100 units.
- **Observed shares:** actual target shot and assist counts determine requested shares, but the passing budget remains 100. This conditions on realized roles without changing the total passing target.
- **Observed passing volume:** use the observed shares and set passing units to `100 * target AST/min / prior league AST/min`. This probes the fixed passing target without using target turnovers. It is another per-minute design convention, not a measured number of passes or an identified causal budget.

Passing costs are allocated first; shots consume the remainder of the 100-event budget together with their linked turnover costs. Passing units never create points. The label is **100 times pooled player turnovers divided by FGA + 0.44 FTA + pooled player turnovers**, not turnovers per 100 physical possessions. Prior league turnover share is the common baseline. No same-season player-turnover identity is presented as successful prediction.

The grid attempts **16,032 cases**. Ten are unsupported because of zero prior passing exposure, all on 1997 NJN; the other 16,022 are evaluated. All model comparisons use teams supported by every case, excluding that team even from its two supported cases. The report retains the exclusions and every individual result.

### Historical Error Results

The temporal partitions were fixed at 1979-2012 and 2013-2026. Neither period is used for fitting in this study. Both draw on already-exposed source data, so the later partition is not fresh release validation. Errors are equally weighted by team-season and measured in percentage points of the shot-plus-player-turnover event proxy.

The table focuses on the shot-only baseline and the split-role policy whose passing-budget assumption is being tested; all four splits and all three allocations remain in the report.

| Period And Prior Coverage | Common Teams | League RMSE | Shot-Only Prior Roles | Split-Role Prior Roles | Split-Role Observed Shares | Split-Role Observed Volume |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1979-2012, all | 915 | 1.074035 | 0.953672 | 1.015686 | 1.079831 | 1.090002 |
| 1979-2012, at least 90% | 288 | 1.082551 | 0.919825 | 0.977180 | 1.048487 | 1.105826 |
| 2013-2026, all | 420 | 0.917925 | 0.847082 | 0.832957 | 0.900143 | 0.931829 |
| 2013-2026, at least 90% | 111 | 0.942924 | 0.826626 | 0.769093 | 0.814717 | 0.845134 |

The earlier all-team cohort has 916 eligible teams before its one common-support exclusion. The other three cohorts lose no teams to policy support. High-coverage results therefore concern only 288 earlier and 111 later teams, not the entire historical population.

For split-role minus shot-only MSE under prior-role allocations, negative means split-role is better. Normal 95% intervals cluster by target season, with 34 earlier and 14 later clusters:

| Period And Prior Coverage | Paired MSE Difference | Lower 95% | Upper 95% |
| --- | ---: | ---: | ---: |
| 1979-2012, all | 0.122129 | 0.044500 | 0.199759 |
| 1979-2012, at least 90% | 0.108803 | -0.037495 | 0.255101 |
| 2013-2026, all | -0.023730 | -0.097126 | 0.049666 |
| 2013-2026, at least 90% | -0.091806 | -0.232596 | 0.048985 |

Split-role has lower point-estimate error in later years but not earlier years. Its later advantage over shot-only is uncertain: both later paired intervals include zero. Supplying actual shot/assist shares increases split-role error in all four cohorts, with positive paired MSE intervals. Replacing the fixed passing target with observed passing volume increases point-estimate error again, but those additional paired intervals include zero. These are unadjusted comparisons, and 14 later season clusters provide limited uncertainty evidence.

This does **not** prove that the fixed 100-unit target is correct or that passing is irrelevant. Better knowledge of roles need not help when the transported per-role turnover costs or their linear response are wrong. The diagnostic distinguishes that issue from merely having inaccurate role shares; it does not identify the causal source of the error.

### Team Label Boundary

All 1,336 pooled-player labels are separately compared with the recorded team-summary `tov_percent`. The pooled-player minus team-summary bias is **-0.431671 percentage points**, with MAE 0.431708 and RMSE 0.474068. They are not interchangeable labels. Player per-game rounding, team-only turnovers and proxy accounting can contribute to the discrepancy; the retained sources do not isolate their contributions. The study neither corrects the label by this average gap nor treats the team-summary rate as an exact sum of player turnovers.

### Team Gate Decision

**The separate-budget design is not ready for production.** It conserves its accounting identities, but a universal linear split between shooting and passing turnover costs has not demonstrated stable historical benefit. Neither choosing the favorable later cohort nor retuning against the exposed roster win bands would resolve that limitation.

The next bounded candidate should test reliability-based shrinkage of prior player turnover costs toward league rates, with any fitted choices learned only from earlier years and the complete later-period comparisons retained. That is a hypothesis about noisy transported rates, not a promised fix. Keep shot-only as a comparator, keep fallback coverage explicit, and do not select a live split merely because one aggregate RMSE is lower. Genuine lineup validation, team-only event treatment, capacity evidence and the broader release requirements still remain.

Reproduce to a new path:

```powershell
& './.venv/Scripts/python.exe' scripts/data_pipeline/audit_team_roles.py --self-test
& './.venv/Scripts/python.exe' scripts/data_pipeline/audit_team_roles.py NEW_TEAM_ROLE_STUDY.json
node --experimental-strip-types --test --test-name-pattern='team role study' src/engine/math.test.ts
```

Verification reconstructs all 16,032 case statuses and budgets, coverage cohorts, metrics and season-cluster intervals independently. Direct CSV checks cover 23,339 target stints, 16,436 distinct prior player-seasons, all 1,336 team-summary rows and every lagged league reference. Changing each case's target turnovers while holding prior inputs fixed leaves all predictions unchanged. Synthetic tests cover neutral accounting, passing-volume changes, unsupported exposure/costs and hand-calculated error intervals. The CLI replays the report byte-for-byte and rejects overwrites. No new dependency, live rule, previous model/writer, processed data, UI or save-schema change is made.

## Candidate 1: Turnover Shrinkage

**Decision: reject at the component gate.** This consumes one of the two mechanisms allowed by the approved release scorecard. The eight-configuration experiment is complete; it does not authorize another shrinkage grid or a revised selection from later outcomes. Live balance remains unchanged.

The [registration](MID_IQ_CANDIDATE_1_PROTOCOL.json) was written and fingerprinted before candidate measurements: SHA256 `f660073f9a4ef7519eab939676a822cb0e098d84d18b58fd70ea2132bcbe2e01`. It addresses B1's unresolved turnover component, not all of basketball credibility. Its hypothesis is that limited prior minutes make transported turnover rates noisy enough for shrinkage toward the previous league rate to help.

For a player with qualifying prior exposure, the retained player weight is `priorMinutes / (priorMinutes + kMinutes)`. Only prior turnover rate is blended toward the prior league rate; prior shots, assists, target-minute exposure, fixed half-shot/half-passing policy, uncapped prior-role allocation and the 100 passing-unit target stay unchanged. Zero shrinkage returns the original input exactly. Existing league-average fallback players remain unchanged. Minutes are a reliability proxy, not an identified sampling-variance model.

[The evaluator](../../../scripts/data_pipeline/evaluate_turnover_shrinkage.py) runs in two stages. [The selection artifact](MID_IQ_CANDIDATE_1_SELECTION.json) records all earlier-period predictions and is written before evaluating the selected configuration in later years. [The result artifact](MID_IQ_CANDIDATE_1_RESULT.json) pins that selection's hash. All sources and the writer are hash-pinned; neither artifact can overwrite an existing path.

Selection minimizes equal-team RMSE on the same 915 common-support teams from 1979-2012, with smaller shrinkage breaking exact ties. No high-coverage subset or later result selects a parameter. All eight configurations support every training team:

| Shrinkage Minutes | Earlier All-Team RMSE |
| --- | ---: |
| 0 | 1.015686 |
| 250 | 1.000007 |
| 500 | 0.997145 |
| 1000 | 1.005093 |
| 2000 | 1.032636 |
| 4000 | 1.078453 |
| 8000 | 1.128470 |
| 16000 | 1.168812 |

The frozen choice is **500 minutes**. Only that choice is newly evaluated in 2013-2026. The cohort is frozen to the previous study's common support: 1997 NJN remains excluded, with no newly dropped teams. All 1,335 retained team-seasons remain supported. Later data were already exposed by earlier studies, so selection isolation does not make this fresh release validation.

| Period And Prior Coverage | Teams | Shot-Only RMSE | Unshrunk Split-Role RMSE | Candidate RMSE |
| --- | ---: | ---: | ---: | ---: |
| 1979-2012, all | 915 | 0.953672 | 1.015686 | 0.997145 |
| 1979-2012, at least 90% | 288 | 0.919825 | 0.977180 | 0.934138 |
| 2013-2026, all | 420 | 0.847082 | 0.832957 | 0.812340 |
| 2013-2026, at least 90% | 111 | 0.826626 | 0.769093 | 0.789423 |

Errors retain the earlier study's percentage-point units for the shot-plus-player-turnover proxy, not physical possessions. The candidate improves later all-team RMSE by more than the registered 2% against both comparators. That alone is insufficient:

- **Pass:** selected shrinkage is positive and no fixed-cohort row becomes unsupported.
- **Fail:** earlier all-team RMSE remains worse than shot-only: 0.997145 versus 0.953672.
- **Fail:** later paired MSE intervals do not establish improvement. Candidate minus shot-only is -0.057652 with interval [-0.130298, 0.014994]; candidate minus unshrunk is -0.033922 with interval [-0.071261, 0.003418]. Both upper bounds exceed zero, contrary to the registered rule. Intervals use 14 season clusters and the existing normal approximation.
- **Fail:** later high-coverage RMSE rises from the unshrunk model's 0.769093 to 0.789423, violating the no-regression rule even though it remains below shot-only.

The earlier selection results and their intervals are development evidence, not independent proof of benefit. These findings reject this registered mechanism as the way forward; they do not prove all possible shrinkage models are ineffective. The approved budget does not permit searching that space indefinitely.

No complete-game integration is attempted after rejection. Missing historical turnovers, team-only events, five-player role capacity, and interaction with scoring, defense, coaches and reserves remain unresolved. No old-era family is dropped from the release requirements, and no historical missing stat is newly filled. B1, B2, P1 and E1 are not passed by this experiment. Fresh roster expectations, final legal-draft measurements and the 12-person pilot remain unused.

Reproduce to two new paths:

```powershell
& './.venv/Scripts/python.exe' scripts/data_pipeline/evaluate_turnover_shrinkage.py --self-test
& './.venv/Scripts/python.exe' scripts/data_pipeline/evaluate_turnover_shrinkage.py select NEW_SELECTION.json
& './.venv/Scripts/python.exe' scripts/data_pipeline/evaluate_turnover_shrinkage.py evaluate NEW_RESULT.json --selection NEW_SELECTION.json
node --experimental-strip-types --test --test-name-pattern='candidate1 shrinkage' src/engine/math.test.ts
```

Verification independently reconstructs all 7,320 training predictions, the minimum-RMSE choice, all 1,335 selected ledgers, cohort metrics, paired intervals and rejection rules. Instrumented selection makes only earlier-period calls and remains unchanged after later player rates and outcomes are altered. Zero shrinkage exactly reproduces every retained original split-role result, and changing target turnovers leaves all selected predictions unchanged. Both CLI stages replay byte-for-byte and reject overwrites. No dependency, production model, prior writer/report, player peak, UI or save-schema changes were made.

## Candidate 2: Role-Normalized Turnover Costs

**Component decision: pass; integration decision: blocked, stop this cycle.** The second and final mechanism uses [five preregistered weights](MID_IQ_CANDIDATE_2_PROTOCOL.json), not another shrinkage grid. [Earlier-only selection](MID_IQ_CANDIDATE_2_SELECTION.json) chose a passing weight of **0.25** before the [selected later evaluation](MID_IQ_CANDIDATE_2_RESULT.json). The protocol SHA-256 is `78f403ecea458a8f98a75d1667e77c970380f06a32cc2d0d2f125afaefad0f12`; both artifacts retain source and implementation hashes. No complete-game gate passes from this result.

### Mechanism and Selection

The [offline evaluator](../../../scripts/data_pipeline/evaluate_role_costs.py) divides each player's prior turnover rate ratio by a weighted combination of prior shot and assist rate ratios. Its shot and passing costs therefore reflect the player's own prior role mix, instead of splitting every player's turnovers identically. At nominal prior exposure, the two components reconstruct observed turnovers. There is no reliability shrinkage, new efficiency bonus or claim that assists identify causal passing skill.

Target-minute weights, previous league reference, source fallback rules, uncapped allocations and the synthetic 100-unit passing budget are unchanged. No target shot, assist or turnover counts enter predictions. Zero passing weight exactly reproduces the original shot-only control. Selection minimizes equal-team RMSE on the original 915 common-support teams from 1979-2012; exact ties favor smaller weights. New unsupported rows would invalidate a configuration rather than change membership. All five configurations support all training rows.

| Passing Weight | Earlier RMSE |
| --- | --- |
| 0 | 0.953672 |
| 0.25 | 0.915380 |
| 0.5 | 0.990584 |
| 0.75 | 1.187947 |
| 1 | 1.560185 |

### Frozen Evaluation

Only the selected 0.25 weight receives new later-period candidate predictions. All 1,335 original common-support teams remain supported; the original exclusion of 1997 NJN is unchanged. Error units are turnover endings per 100 `FGA + 0.44 * FTA + TOV` events, not game wins or true possessions.

| Cohort | Teams | Shot-Only RMSE | Universal Split RMSE | Candidate 2 RMSE |
| --- | --- | --- | --- | --- |
| 1979-2012, all | 915 | 0.953672 | 1.015686 | 0.915380 |
| 1979-2012, >=90% prior-minute coverage | 288 | 0.919825 | 0.977180 | 0.885167 |
| 2013-2026, all | 420 | 0.847082 | 0.832957 | 0.789238 |
| 2013-2026, >=90% prior-minute coverage | 111 | 0.826626 | 0.769093 | 0.744878 |

All four registered rules pass:

- Positive selected passing weight, with full original common support.
- Earlier all-team RMSE no worse than shot-only.
- Later all-team RMSE improves 6.83% versus shot-only and 5.25% versus the unshrunk universal split, exceeding the 2% requirement. Candidate-minus-baseline paired MSE differences are **-0.094650 [-0.133615, -0.055686]** and **-0.070920 [-0.116030, -0.025810]**, respectively; both normal 95% season-cluster intervals exclude zero.
- Later high-coverage RMSE is no worse than either baseline. Its paired difference versus the universal split is **-0.036661 [-0.087622, 0.014300]**: the subgroup does not establish a significant improvement over that baseline, nor was that required by registration.

Earlier statistics are selection evidence. Later years were already exposed in previous research and are not the scorecard's fresh validation panel. These are team-season conditional estimates using actual target minutes, not preseason forecasts or five-player lineup outcomes. Synthetic passing units, prior role exposure and team-only turnover accounting remain limitations; positive component evidence does not validate arbitrary lineup role expansion.

### Integration Assessment and Stop

The nearest lineup abstractions, [role allocation](../../../src/engine/role-allocation.ts) and [lineup offense](../../../src/engine/lineup-prototype.ts), consume complete shot, turnover, assist and efficiency inputs. A new version could express candidate 2's player-specific costs, but code compatibility alone would not resolve these existing release blockers:

| Required Criterion | Evidence | Consequence |
| --- | --- | --- |
| B1: retain every approved historical family | The frozen input audit leaves 714 of 4,411 versions without complete selected-peak turnovers. E05 lacks Milwaukee Kareem; F06 lacks Boston Russell, Philadelphia Chamberlain and Milwaukee Kareem. | Cannot evaluate every required roster. Do not fill missing values, change peaks or drop families without an approved policy. Team-study previous-league fallback does not authorize imputing historical peaks. |
| B1: complete team strength and roster expectations | This component predicts turnover endings only. Existing lineup prototypes omit the complete scoring/defense/spacing/coach/reserve/opponent integration. Fit 18 already failed five formerly reserved bands. | No frozen complete-game candidate; a points/rating bridge or combining this component with fit 18 would be a new modeling choice, not a mechanical adoption. |
| B2/P1/E1: game acceptance | No finalist policy evaluation, new-family panel, player pilot or candidate build/browser run. | Remain unmeasured or partial, not passes. The 75 passing engine tests establish software/evidence consistency only. |

**Keep `season-3 / mid-iq-2 / conditional-score-3` live. Both candidate mechanisms are consumed, so do not launch candidate 3, expand the weight grid or consume fresh expectations to compensate.** The successful component is retained for potential integration, not rejected on new statistical criteria and not promoted into production.

Recommended next decision: preserve the historical roster scope and keep current live balance. Continuing the replacement would require explicit approval of a new bounded integration cycle, starting with an uncertainty-aware historical missing-data policy and a frozen complete-strength mapping. The alternative is an explicitly narrower supported-era product, which would require changing the approved scope and families. Neither change is authorized here; lowering win targets or silently excluding historical stars is not an acceptable substitute.

### Verification and Replay

Python synthetic checks cover neutral budgets, reconstruction at prior exposure, exact shot-only control, heterogeneous roles, permutation invariance, unsupported budgets, invalid weights, tie selection, input immutability and decision boundaries. The independent TypeScript test reconstructs all 4,575 training ledgers and 1,335 selected ledgers through player-specific turnover fractions, then verifies selection, four cohort metrics, paired intervals and all decision rules.

Actual-data instrumentation confirms all 4,575 selection calls use earlier years. Changing every later team's prior rates and outcomes leaves selection unchanged; changing target shot, assist and turnover counts leaves all 1,335 selected predictions unchanged. Every original shot-only control replays exactly. Both CLI artifacts reproduce byte-for-byte and reject overwrites; all source hashes remain intact. **75/75 engine tests pass**, typecheck passes, and touched code has no editor diagnostics. No production code, prior frozen writer/report, dependency, peak, UI or save schema changed. No build/browser or human validation was run for this offline component.

```powershell
& './.venv/Scripts/python.exe' scripts/data_pipeline/evaluate_role_costs.py --self-test
& './.venv/Scripts/python.exe' scripts/data_pipeline/evaluate_role_costs.py select NEW_SELECTION.json
& './.venv/Scripts/python.exe' scripts/data_pipeline/evaluate_role_costs.py evaluate NEW_RESULT.json --selection NEW_SELECTION.json
node --experimental-strip-types --test --test-name-pattern='candidate2 role costs' src/engine/math.test.ts
```

## Integration 1: Historical Missing-Data Gate

**Decision: stop this integration cycle at stage 1.** On 2026-09-15, the user said "go with your recomendation", authorizing the recommended bounded integration work while preserving historical roster scope. [Protocol 1](MID_IQ_INTEGRATION_1_PROTOCOL.json) permits one missing-data policy and, only after that gate passes, one frozen complete-strength mapping. Candidate 2's passing weight stays at 0.25; there is no turnover-weight search or change to release targets. The protocol SHA-256 was frozen before measurement: `a9a933d9b923dc21e44346aa805a8daa80af68566e1f4d8fe221af08d9432232`.

### Registered Method

The [new evaluator](../../../scripts/data_pipeline/evaluate_missing_turnovers.py) tests whether known turnovers can be recovered from observed shooting and assist workloads. It uses the mean turnover rate of exactly 50 nearest donors, with distance based on donor-standardized shot endings and assists per 36 minutes. The donor target mean is the constant baseline. There is no neighbor-count, feature, bandwidth or threshold search.

Underlying player identities are partitioned by SHA-256 modulo 10: buckets 0-5 donate, 6-7 calibrate, and 8-9 evaluate. Every version of a player stays in one partition. Each cohort retains one eligible version per identity, selected by greatest observed peak minutes with lexicographic version-id ties. Every selected season must fall inside its cohort window. These restrictions prevent same-player versions from acting as their own donors or appearing in both calibration and evaluation.

| Cohort | Peak-Season Window | Distinct Players | Permitted Role |
| --- | --- | --- | --- |
| Donor | 1978-2002 | 433 | Fit feature scales, nearest-neighbor point estimate and constant baseline |
| Calibration | 2003-2012 | 68 | Set the absolute-residual interval radius only |
| Evaluation | 2013-2026 | 117 | Measure the frozen estimate and interval |

The [fit artifact](MID_IQ_MISSING_TURNOVERS_FIT_1.json) was written before evaluation. Its nominal 90% split-conformal radius uses sorted absolute calibration residual rank `ceil((68 + 1) * 0.9) = 63`; intervals are prediction plus/minus that radius, clipped at zero on the lower side. The [evaluation artifact](MID_IQ_MISSING_TURNOVERS_RESULT_1.json) pins the fit hash and retains every evaluated player, all 50 donor neighbors, observed label, prediction and interval.

This is a masked modern-peak transport screen, not a forecast or proof of historical truth. Donor and later-era players need not be exchangeable, so nominal conformal coverage is not guaranteed across eras. The test measures that limitation rather than asserting it away. The historical source data were already exposed in earlier research; this is not the release scorecard's fresh panel.

### Results and Fixed Gates

All rate errors below are turnovers per 36 minutes. The uncertainty and bias tolerances were implementation screening criteria registered under the bounded-cycle authorization before measurement, not changes to the user-approved game acceptance targets.

| Criterion | Registered Requirement | Observed Result | Verdict |
| --- | --- | --- | --- |
| Evaluation support | At least 40 distinct players | 117 | Pass |
| Prediction validity | All predictions and interval endpoints finite and nonnegative | 117 of 117 | Pass |
| Point-estimate error | RMSE no worse than donor-mean baseline | 0.643076 versus 0.798315 | Pass |
| Absolute bias | At most 0.25 | +0.366015 | **Fail** |
| Empirical interval coverage | At least 85% for nominal 90% intervals | 97/117 = 82.905983% | **Fail** |
| Mean interval width | At most 3 | 1.705616 | Pass |

MAE is 0.524646 turnovers per 36. The role-informed point estimate improves over the constant, but systematically overpredicts later players and its intervals miss more observed labels than permitted. Lower RMSE does not override either failed criterion. This result does **not** prove that all historical imputation methods fail or identify the cause of the bias; it rejects this single registered policy for this integration cycle.

### Consequences

No modeled historical-input layer was emitted. All 714 incomplete player versions retain their raw missing values and original peaks. E05 and F06 remain required, not excluded. Candidate 2's earlier turnover-component pass is unchanged, but cannot authorize combining it with unsupported historical estimates. The complete-strength mapping, exposed-roster integration measurement and all fresh-family, finalist-policy and human stages were not attempted.

Keep the existing `season-3 / mid-iq-2 / conditional-score-3` release and every historical player. Do not silently bias-correct this estimator, change neighbors, widen intervals or spend the unused mapping stage on a second missing-data policy. Any such work requires a new explicit decision. The current record supplies no new evidence of improved gameplay.

Recommended product decision after this stop: pause balance-model research and gather exploratory player feedback on the current live game before authorizing another replacement model. That would identify whether draft tradeoffs, outcome credibility or repeat play actually need attention. Such a baseline study would require its own scope and real participants; it has not been run and would not consume or pass the frozen-finalist pilot by implication.

### Verification

The independent TypeScript test reconstructs cohort membership, source hashes, all donor scales, all 185 calibration/evaluation predictions and 9,250 retained neighbor entries, calibration rank, every interval, metrics and exact failed rules. Instrumented Python fitting never requests the evaluation cohort. Changing evaluation features and labels leaves the fit unchanged; changing evaluation labels alone leaves all 117 predictions and intervals unchanged. Calibration labels change the interval radius but not point predictions, donor scales or baseline.

Both CLI stages reproduce byte-for-byte and reject overwrites. All upstream source hashes remain unchanged. **76/76 engine tests pass** and typecheck passes. Production code, player data, prior frozen writers/reports, dependencies, UI and save schemas were not changed. No build, browser journey, historical imputation or human study was run.

```powershell
& './.venv/Scripts/python.exe' scripts/data_pipeline/evaluate_missing_turnovers.py --self-test
& './.venv/Scripts/python.exe' scripts/data_pipeline/evaluate_missing_turnovers.py fit NEW_FIT.json
& './.venv/Scripts/python.exe' scripts/data_pipeline/evaluate_missing_turnovers.py evaluate NEW_RESULT.json --fit NEW_FIT.json
node --experimental-strip-types --test --test-name-pattern='integration1 masked turnovers' src/engine/math.test.ts
```

## Verification Scope

Final verification: **65/65 engine tests pass**, the Python audit self-checks pass, `npm.cmd run typecheck` passes, and the edited files have no reported editor diagnostics. All 57 documentation links resolve; the prototype and era tables match their reports, source hashes remain unchanged, and the audits refuse overwrites. The era report also reproduces byte-for-byte to a temporary output.

First-cycle verification was 53/53 engine tests; earlier continuations finished at 59/59, 61/61, 62/62 and 64/64. The current 31-test math suite additionally covers system-coach liability isolation, frozen fits 16/18, the failed reserved report, possession accounting, independent input-audit reconstruction and season-relative context. An independent neutral-rating calculation reproduces full-pool expectations and exact band classifications, including all nine reserved outcomes. JSON replay comparisons respect serialization of negative zero as zero; they do not round ratings. The CLI regression checks legal paired controls, nested menus, probability ordering, no-overwrite behavior, rejection of a development failure before reserved measurement and rejection of a changed fit after exposure. All report stress runs completed action-history recovery. The candidate and possession prototype remain referenced only by the offline evaluator and tests.

No new dependency remains: an attempted external optimizer package was removed after incompatible exports and obsolete transitive dependencies; the manifest and lockfile root match, with no `fmin` entries. Production math, save schema, UI and servers remain unchanged. Build/browser/playoff/title/human-engagement validation was not run for this rejected offline candidate. The reserved validation and release verdict is **FAIL**, regardless of passing software tests.
