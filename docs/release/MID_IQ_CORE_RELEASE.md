# Mid IQ Scoring-Core Balance Release

Date: 2026-09-14. Released for new runs as `season-3` / `conditional-score-3`.

## Goal and Scope

The user adopted the goal that a complementary roster like Brunson, Toronto Tucker, early Memphis Brooks, Duncan, Knicks Towns and Indiana LaSalle Thompson under Popovich should usually contend for qualification.

Operational target, stated before the first experiment: 60-63 expected regular-season wins and 55-75% probability of 60+ wins on the reference schedule. This is a design target for a regression case, not a promise for every draft or seed. No individual player, franchise, seed or coach receives a special-case bonus.

Only starter offensive aggregation changes. Usage, spacing, defense, bench quality, fatigue, coach modifiers, sigmoid width, opponent selection, qualification thresholds and score parameters remain unchanged. This is not a comprehensive balance sign-off or a playoff/title validation.

## Released Formula

Individual contribution remains normalized PTS times coached FG% plus normalized AST. Let `allMean` be the five-starter mean and `coreMean` the mean of the three largest contributions:

```text
Legacy ORTG = 95 + allMean
New ORTG    = 95 + 0.20 * allMean + 0.80 * coreMean
```

The usual usage and spacing multipliers apply afterward. The baseline 95 is unchanged. The core is determined by offensive contribution, not OVR, name, position or draft order. Each top-three contributor effectively has weight 0.306667; each other starter has weight 0.04. Increasing any starter's contribution increases offense, and rank crossings are continuous. A lineup with five equal contributions is unchanged.

This intentionally rewards a scoring core supported by role players. It is also a substantial change in marginal offensive weights; a scorer outside the top three has much less offensive value than a core scorer. All five still contribute to usage, spacing and defense. Whether this encourages too much specialist concentration remains an explicit follow-up risk.

## Reference Roster

Seed: `50b9c2a6-c5c3-4bf3-8497-db022533d443`.

| Measure | Original Balance | Released Balance |
| --- | ---: | ---: |
| Expected wins on original schedule | 53.94 | 60.05 |
| Probability of 60+ wins | 8.66% | 56.32% |
| Effective offense | 110.67 | 114.68 |
| Team net rating before game context | +11.16 | +15.17 |
| Same-seed actual record | 53-29 | 57-25 |

The original result uses its original score rules and retains +626 differential exactly. The candidate replay uses the latest score rules; winner changes arise from balance, not score sampling. Neither replay overwrites the user's existing save.

The new same-seed run still misses qualification. The release targets a plausible chance, not a scripted result. The qualification probability is calculated by convolving the 82 independent Bernoulli game distributions for this fixed lineup and schedule, not by treating a few replays as a reliable rate estimate.

## Development and Fresh Evaluation

1. [Initial experiment](../research/mid-iq/MID_IQ_OFFENSE_EXPERIMENT_1.json): weights 0, 0.25, 0.5, 0.75 and 1, using the reference roster and 900 previously exposed draft rosters/schedules. All retained baseline schedule expectations were reproduced within 1e-8 before evaluation.
2. [Frozen candidate](../research/mid-iq/MID_IQ_OFFENSE_CANDIDATE.json): weight 0.8. The 0.75 variant fell just below the reference qualification target; weight 1 removed supporting players' direct offensive contribution entirely. The frozen candidate meets the target while keeping all five contributions positive.
3. [Fresh legal redrafts](../research/mid-iq/MID_IQ_CORE_REDRAFT_1.json): prefix `mid-iq-core-validation-1-`, evaluated after freezing 0.8, with both rule versions drafting for their own objective. Six policies have 100 seeds each per version; lookahead has 20 per version. Total: 1,240 completed drafts. All action histories recover through the legal run engine. No tuning followed this evaluation.

| Policy | Seeds per Version | Old Median Wins | New Median Wins | Old 60+ Share | New 60+ Share |
| --- | ---: | ---: | ---: | ---: | ---: |
| Random player-slot choices | 100 | 32 | 34.5 | 0% | 1% |
| Chemistry-aware | 100 | 60 | 62.5 | 54% | 67% |
| OVR-first | 100 | 16 | 16.5 | 0% | 0% |
| Usage-maximizing | 100 | 5 | 5.5 | 0% | 0% |
| Non-shooting | 100 | 16 | 17.5 | 0% | 0% |
| Defense-first heuristic | 100 | 45.5 | 52.5 | 23% | 31% |
| Bounded lookahead | 20 | 69 | 70 | 95% | 100% |

These are observed rates, unlike the fixed-roster probability above. Approximate 95% Wilson intervals for new qualification rates: chemistry 57.3-75.4%; defense-first 22.8-40.6%; lookahead 83.9-100%. The 20-run lookahead result does not imply guaranteed qualification. New lookahead median expected wins are 69.93, and its mean conditional qualification probability is 98.37% on these selected rosters/schedules.

Chemistry-aware median and qualification results fall inside the original provisional ranges. Lookahead's sample median falls inside its original range, but 20 seeds are insufficient to establish that as a population result. Random still misses the original targets; that previously accepted exception is not resolved. OVR-first remains a poor proxy for effective team building, and its result highlights unresolved talent/usage tradeoffs rather than proving that human newcomers will win 16 games.

The non-lookahead policies choose an offered coach randomly and do not reroll. Chemistry ranks legal player-slot choices by projected fit; OVR-first ranks by OVR; the extreme and defensive controls retain their earlier objectives. Lookahead uses the existing six-choice shortlist plus slot coverage, 12 hypothetical continuations, legal rerolls and expected-win objective. Its coach optimization is not isolated from its other advantages. Policy randomness is independently keyed; matching seeds do not guarantee identical later offers after different draft actions.

## Compatibility and Reproduction

| Saved Engine | Balance | Scores |
| --- | --- | --- |
| `season-1` | `mid-iq-1`, original average | `conditional-score-1` |
| `season-2` | `mid-iq-1`, original average | `conditional-score-3` |
| `season-3` | `mid-iq-2`, scoring-core blend | `conditional-score-3` |

New runs use season-3. Existing versioned drafts, interrupted seasons and completed results retain their original balance and scores. Preview and season evaluation select the same rules from the saved engine version. No destructive migration, seed change, RNG algorithm change, data change or save-schema bump occurs. A new run is required to opt into the balance release.

Low-level math, policy and season APIs retain their legacy defaults for compatibility; callers evaluating a current run must pass `balanceForRun(run)` or explicit balance rules. The app and main calibration CLI do this. Changing only a completed save's engine label does not migrate it and fails rating validation.

```sh
npm test
npm run build
node --experimental-strip-types src/engine/calibrate-scores.ts replay-release
node --experimental-strip-types src/engine/calibrate-balance.ts
node --experimental-strip-types src/engine/calibrate-balance.ts NEW_REPORT.json redraft
node --experimental-strip-types src/engine/calibrate.ts 100 NEW_REPORT.json chemistry NEW_SEED_PREFIX season-3
```

Use unused output paths. Reports are non-overwriting. The balance experiment without `redraft` reproduces the retained candidate analysis; the initial five-weight artifact is historical. For the older calibration workflow, explicitly select `season-1` or `season-2` as the last argument. Reusing the exposed seed prefix is reproduction, not fresh validation.

Verification: 49 engine tests pass, including the exact original reference result, new qualification probability, monotonic supporting-player offense, three-version recovery, preview/simulation agreement and playback immutability. The main calibration CLI was exercised with season-3. Released score replay still reproduces all retained historical statistics with unchanged numeric score parameters; this does not claim the new balance has an unchanged league-weighted score distribution.

Production build and TypeScript checks pass. The local production app was restarted on port 3000. In a separate browser origin, a new season-3 draft was completed through legal UI selections, its offense was independently recomputed from player statistics, the displayed preview matched the stored season evaluation, and all 82 games survived reload unchanged. The first animated coach-card click required bypassing Playwright's stability wait. No user save was reset. This checks the changed numeric workflow; it is not a new comprehensive visual/accessibility review.

Remaining work: larger optimized-policy evaluation, human draft testing, coach-specific redrafting, spacing cliffs, bench usage costs, era viability and postseason progression. These are not silently changed or declared solved by this release.
