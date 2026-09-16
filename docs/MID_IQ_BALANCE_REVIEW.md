# Mid IQ Balance Deep Dive

Date: 2026-09-14. Status: analysis and recommendations, not an approved retune.

Subsequent decision: the user adopted qualification contention for the reference roster. The [season-3 scoring-core release](MID_IQ_CORE_RELEASE.md) documents the resulting single-variable change and fresh evaluation. This review remains the pre-change diagnosis; its other proposed retunes are not implemented.

## Recommendation

Keep Mid IQ's identity: strong players matter, complementary roles matter, and better drafting materially improves results. Before further feature work, investigate whether current chemistry penalties and threshold bonuses are too large relative to individual talent. Do not start by lowering the qualification gate or changing the sigmoid to make every roster win more.

The baseline demonstrates a skill-sensitive drafting puzzle. It does not yet demonstrate an approachable default mode, broad strategic diversity, balanced coaches, or a complete championship progression curve. Those are separate claims from the accepted historical score calibration.

No runtime, data, version, target, or roadmap status changed in this review. P3.7 remains complete with its accepted exceptions. Any proposed balance change requires a new decision and version-compatible implementation.

## Evidence and Method

- Primary evidence: [retained P3.7 report](PHASE3_REVIEW.json), 100 seeds for each of nine legal drafting policies, plus its [methodology and uncertainty](PHASE3_REVIEW.md).
- Current formulas: [math.ts](../src/engine/math.ts). Policy definitions: [calibrate.ts](../src/engine/calibrate.ts) and [draft-strategy.ts](../src/engine/draft-strategy.ts). Current targets and postseason rules: [GAME_DESIGN.md](GAME_DESIGN.md).
- Reconstructed all 900 rosters from saved ordered player IDs and coach IDs using current processed data. Computed spacing tiers, base offense, usage and spacing effects, and bench diagnostics without changing inputs.
- Reconstructed the saved schedules for the random, chemistry, and lookahead groups. All 300 schedule-conditioned expected-win totals match retained values within 1e-8. Used their individual game probabilities for outcome variance and conditional undefeated probabilities.
- Coach diagnostics apply all 12 coaches to the same 100 retained lookahead rosters. These swaps ignore original offers and do not redraft around each coach. They are mechanism checks, not legal counterfactual runs or unbiased rankings.
- This is exploratory reuse of exposed evidence, not a new held-out validation. The original review used season-1 scores; the released season-2 score changes preserve win probabilities and winners, so these win-balance measurements remain relevant. Old score-distribution findings are historical, superseded by the [accepted score release](PHASE3_SCORE_RETRY.md).

## 1. Difficulty and Progression

All percentages below are counts out of 100 retained runs. Direct bracket entry means 65+ wins. The 60-64 band requires a sudden-death away play-in under the adopted design; postseason outcomes are not implemented or measured here.

| Policy | Median Wins | 60+ Wins | Play-In Only | Direct Bracket |
| --- | ---: | ---: | ---: | ---: |
| Random | 32 | 0% | 0% | 0% |
| Chemistry | 61 | 61% | 31% | 30% |
| Reroll-aware | 62 | 60% | 27% | 33% |
| Balanced | 60 | 53% | 34% | 19% |
| Usage-maximizing | 4 | 0% | 0% | 0% |
| Non-shooting | 17 | 0% | 0% | 0% |
| Defensive | 38 | 10% | 8% | 2% |
| Bench-heavy | 60 | 54% | 28% | 26% |
| Lookahead | 67 | 90% | 25% | 65% |

Chemistry-aware drafting meets the provisional 60-66 median and 55-75% qualification ranges. Random misses its original 45-55 median and 10-20% qualification targets substantially. Lookahead is stronger but does not establish the proposed 68-74 median range. Its paired expected-win advantage over chemistry is 5.99 wins, with approximate 95% interval 4.73-7.25.

Qualification is not the same as experiencing a playoff series: about half the qualifying chemistry runs first face an elimination game. That may be suitable for a difficult challenge, but should be deliberate for the default experience. Title accessibility cannot be inferred from the 61% qualification figure.

### Benchmark Limitations

- Random selects uniformly among legal player-slot choices, not uniformly among famous players, and never rerolls. Multi-position players can appear in multiple choices. It is not a measured novice-human baseline.
- The overloaded policy maximizes usage with only a small OVR contribution. Its four-win median does not establish that every plausible star-stacked roster is that weak.
- The defensive policy maximizes individual defensive composite with little fit weight. It does not search for the strongest defense-first roster with adequate shooting and offense.
- Eight controls choose coaches randomly; lookahead optimizes coach choice, picks and rerolls together. Its improvement is not an isolated estimate of better player selection.
- Reroll-aware and chemistry have nearly identical mean expected wins, about 60. That diagnoses this greedy reroll heuristic, not the inherent value of the tokens.

Recommendation: retain the original targets and exceptions. Add a separate, explicit star/OVR-first novice proxy and human playtests; do not silently redefine random or move its failed targets to another mode.

## 2. Spacing: The Largest Threshold Risk

The spacing modifier multiplies the entire offensive rating, including its fixed 95-point baseline. At ORTG 107 and neutral usage:

| Boundary | Modifier Change | Immediate Rating Gain |
| --- | ---: | ---: |
| Just below 2 to 2 | -15% to 0% | +16.05 |
| Just below 5 to 5 | 0% to +5% | +5.35 |
| Just below 10 to 10 | +5% to +12% | +7.49 |

These are isolated formula examples, not measured legal player swaps. Holding everything else fixed, the first jump moves an initially even matchup from 50% to about 82.2% win probability. A tiny improvement at a tier boundary can therefore exceed the value of a substantial talent upgrade elsewhere.

| Policy | Poor | Average | Good | Elite |
| --- | ---: | ---: | ---: | ---: |
| Random | 34 | 52 | 14 | 0 |
| Chemistry | 0 | 28 | 72 | 0 |
| Defensive | 52 | 43 | 5 | 0 |
| Lookahead | 1 | 5 | 83 | 11 |

Lookahead reaches Good or Elite in 94% of these drafts. Elite is useful but clearly not required for strong results. Avoiding Poor and reaching Good appear much more central to the successful strategy distribution.

Defense-first rosters average DRTG 95.44 versus chemistry's 98.25, an advantage of about 2.8 rating points. Their average spacing contribution is -7.92 versus +3.84, a gap of about 11.8 points. This is descriptive, not a causal attribution of the entire win gap, but explains why merely buffing defense could miss the main constraint.

**Risk:** a shooter that crosses a numeric boundary becomes mandatory even when the actual shooting improvement is tiny. Coaches who change 3P% inherit the same discontinuities.

**Proposed experiment:** compare a continuous spacing curve against current tiers, initially preserving representative low/middle/high effects so shape and strength are not changed simultaneously. If that still overwhelms talent, test reduced whole-offense strength separately. Keep familiar tier labels as feedback if useful, without requiring discontinuous simulation effects.

## 3. Usage: Fit Can Overwhelm Talent

With a 20-usage bench player and no cap bonus, starters must total at most 107 to avoid overload: an average of 21.4 each. Two 30-usage stars leave 47 for the other three starters, or about 15.7 each. Three leave only 17 for the other two.

Above the cap, each additional usage point removes 0.8% of whole-team offense until the floor. At ORTG 107 and Good spacing, that costs about 0.90 rating points per usage point. In contrast, increasing one starter's normalized PTS by 10 at FG% .50 adds only 1 point of base team ORTG before modifiers, with all other inputs fixed.

The retained usage-maximizing rosters average base ORTG 110.69 versus chemistry's 106.77, only about 3.9 points more. Their mean usage effect, evaluated with spacing held fixed, is -40.13 rating points. All 100 incur overload. These are deliberately extreme builds, but the scale difference is real.

There is also no explicit minimum shot-creation requirement. Low usage can receive up to +3% efficiency; any lost scoring ability is represented only indirectly by PTS/FG%/AST. Test whether low-usage specialists are overvalued before adding a new rule.

**Proposed experiment:** use real legal substitutions to plot marginal expected wins against added usage, including one-star, two-star and three-star builds. Test a gentler overload slope or different penalty application only after measuring where credible teams become noncompetitive. Do not assume every all-star must fit every roster.

## 4. Sixth Man: A Potentially Negative Upgrade

The bench contributes usage at 0.4 weight but no direct starter offense or spacing. Its benefit is FRF-based: +2 permanent rating at maximum quality, plus up to +7 fatigue relief on 14 games. Across the schedule, maximum gross benefit is about 3.20 rating points before usage costs.

Once FRF reaches 1, additional bench scoring, assists or positive DBPM cannot improve its benefit. Higher usage can still hurt. Thus a more famous or higher-scoring sixth man can be a worse selection, and two otherwise different saturated bench players differ primarily through usage in this engine.

Diagnostic: compare each roster's full schedule-average rating with the same starters and coach but no bench. This removes bench usage and FRF together. It is not a legal five-player alternative and is not a title/win simulation.

| Policy | Mean Net Bench Rating Effect | Negative Effect Count |
| --- | ---: | ---: |
| Random | -0.02 | 31/100 |
| Chemistry | +1.94 | 2/100 |
| Usage-maximizing | -8.40 | 100/100 |
| Bench-heavy | +2.09 | 6/100 |
| Lookahead | +1.85 | 6/100 |

**Interpretation:** choosing a low-usage, useful bench is a genuine optimization decision. The concern is whether the model overcharges a reserve for possession competition while representing their minutes only through abstract bonuses.

**Proposed experiment:** compare legally available sixth men with similar FRF but different usage, and starter/bench assignments of the same six players. Evaluate bench usage weight separately from FRF scaling. Do not buff all bench benefits to compensate for a few overloaded builds.

## 5. Defense, Coaches and Eras

### Defensive Roles

Away from liability thresholds and anchor changes, +1 defensive composite on the leading PF/C improves team rating by 0.56; on the other big, only 0.06; on a perimeter starter, about 0.193. That is an intentional one-anchor structure, but means two outstanding big defenders have sharply diminishing defensive value.

Slot assignment can matter even for the same legal five players. Also, the extra liability penalty triggers on negative total defensive composite, not simply negative DBPM; positive rebounds, steals and blocks can offset DBPM. Do not infer that every reputation-based poor defender triggers the extra penalty.

Test best-achievable defense-first builds with adequate spacing, plus legal position swaps, before changing defensive coefficients. These archetype heuristics alone do not establish defense viability.

### Coach Effects

The `pace` modifier is a direct win-rating bonus or penalty, not a possession-count adjustment. A fast coach receives a generic benefit, while a slow coach must recover the penalty through other terms.

Applying every coach to the same 100 lookahead rosters gives these illustrative schedule-average rating differences versus no coach:

| Coach | Mean Rating Effect | Negative in Sample |
| --- | ---: | ---: |
| Red Auerbach | +1.99 | 0/100 |
| Don Nelson | +1.92 | 0/100 |
| Chuck Daly | +1.37 | 19/100 |
| Pat Riley | +0.88 | 11/100 |
| Steve Kerr | +0.41 | 74/100 |
| Phil Jackson | -0.11 | 84/100 |
| Larry Brown | -0.14 | 100/100 |
| Gregg Popovich | -0.22 | 85/100 |

These are not coach rankings: the sample was selected by another policy, swaps may not have been offered, and rosters were not optimized anew. Averages hide large threshold-dependent gains, notably for shooting and usage coaches.

Nevertheless, Larry Brown's result has a clear local explanation. Without liability changes, +0.6 DBPM across starters adds 1.8 defensive rating benefit; his pace penalty costs 2. Bench relief usually recovers only part of the difference. His niche may depend on liability thresholds that many strong rosters avoid.

**Proposed experiment:** forced-coach legal redrafting with matched seed sets and enough samples per coach; measure both median performance and roster-specific upside. Review whether `pace` is intended to mean generic team strength before adjusting its values. Coaching should offer distinct viable choices, not necessarily identical averages.

### Era Viability and Individual Quality

Spacing deliberately uses raw historical 3PA with no era normalization. Older non-shooters must find modern shooting elsewhere; evidence that every era was selected is not evidence of equal usefulness or viable all-era rosters. Curated pre-1974 defensive values also affect anchor selection and deserve sensitivity analysis, not silent replacement.

Individual offense uses PTS times FG% plus AST, averaged across five starters. PTS already contains scoring volume, while FG% does not distinguish two-point and three-point efficiency like eFG% or TS%. OVR is not itself an input to game evaluation. A high-OVR player may therefore be a poor game-model fit for reasons users cannot infer from the overall number alone.

Measure how often selecting a historically strong player is a reasonable legal upgrade. Do not replace the player-quality formula or historical data during a chemistry experiment; that would mix separate causes.

## 6. Skill, Luck and the 98-0 Goal

For fixed lineup and schedule, independent winner draws imply season variance equal to the sum of p*(1-p). The table uses the square root of mean conditional variance, not an empirical interval from rerunning each season.

| Policy | Across-Roster Expected-Win SD | Conditional Outcome SD | Schedule-Deviation SD |
| --- | ---: | ---: | ---: |
| Random | 12.48 | 3.95 | 0.31 |
| Chemistry | 5.07 | 3.86 | 0.22 |
| Lookahead | 5.39 | 3.46 | 0.18 |

Roster variation includes rolls, coach offers and policy decisions; it is not a pure skill-versus-luck decomposition. However, the tiny schedule variation and roughly six-win paired lookahead advantage argue against schedule difficulty being the main balance problem. Near 60 or 65 wins, outcome luck can still substantially change progression.

For a fixed schedule, 82-0 probability is the product of its 82 win probabilities. Across the 100 retained lookahead rosters/schedules, the mean is about 0.00312%, or roughly 1 in 32,000. The strongest conditional case is about 0.219%, or 1 in 456. These are model probabilities on this selected sample, not measured fresh-run rates or a population guarantee; the mean can be tail-sensitive.

98-0 additionally requires 16 straight playoff wins, so it is rarer still. Its frequency is not established without the postseason. Recommendation: treat championships as the repeatable success loop and perfection as a separate exceptional achievement. Do not increase all win probabilities merely to make the title's perfect-run challenge common.

## 7. Recommended Next Decision and Experiments

Recommended default-mode contract: informed drafting should usually produce a credible contender; familiar stars should remain useful in appropriate roles; several roster styles should work; poor fit should hurt without every ordinary mistake ruining an entire run. This is a proposed design interpretation, not a replacement for the accepted numeric targets.

1. Add missing benchmarks: visible-stat/OVR-first novice, one-star and two-star fit-aware policies, and constrained defense-first builds. Keep random and the extreme controls for continuity. Record outcomes from human playtests separately.
2. Run legal substitution and assignment diagnostics for spacing boundaries, overload, and bench usage. Report expected-win changes, not just raw rating changes. Use these to choose the first single-variable experiment.
3. Compare spacing smoothing, usage sensitivity and bench usage treatment separately on development seeds. Measure chemistry-aware performance, novice accessibility, archetype diversity and marginal star value together. Do not tune to a single median.
4. Evaluate coaches through coach-specific legal redrafting and era viability through achievable mixed-era lineups. Use fixed-roster checks as explanations, not final acceptance evidence.
5. Freeze any candidate and success criteria before a fresh evaluation. Preserve the current baseline, existing target exceptions and exposed seed sets. Report uncertainty and failures explicitly; further tuning makes that evaluation set development evidence.
6. Validate title frequency and play-in attrition once postseason simulation exists. Do not claim current regular-season acceptance establishes championship accessibility or 98-0 frequency.

Do not change sigma, qualification thresholds, score calibration or opponent difficulty as the first response to local chemistry problems. Any eventual probability-affecting release must preserve old saves' win rules as well as scores; the current score-only version migration is not by itself sufficient for a future shared-math retune.
