# Mid IQ Release Scorecard

Date: 2026-09-15. Revision: `mid-iq-scorecard-1`. Status: **user-approved acceptance contract; release gates not yet passed**.

Approved as written on 2026-09-15, with no exceptions specified. This approval adopts the targets, measurement rules, playtest thresholds and validation budget below. It does not approve a candidate, fresh roster expectations or a replacement release.

## Current Qualification Revision

On 2026-09-16, the user raised new-run qualification from 40 to 45 wins. New runs use `season-7` / `mid-iq-3` / `conditional-score-3`: after all 82 games, fewer than 45 wins misses qualification and 45-64 wins enters the play-in. Higher seeding thresholds are unchanged. Season-6 scoring, usage, ratings and seeded game results are unchanged; existing saves retain their original version and qualification threshold.

The focused run/season suite passes 23 tests, including 44/45-win boundaries, incomplete-season rejection, gameplay parity and save recovery. This is not a new balance or human-playtest sign-off. Frozen reports, including season-6 benchmarks measured at 40 wins, remain historical evidence and must not be relabeled as season-7 qualification results.

## Goal And Scope

Build a replayable basketball drafting game: talent matters, fit creates meaningful tradeoffs, several basketball identities can succeed, and a loss leaves players understanding the outcome and wanting another attempt.

The next deliverable is a **Mid IQ regular-season balance release**, covering legal six-player drafting, coaching, all 82 games, qualification and understandable feedback. It is not a claim that the whole product is finished. A more elaborate simulator or a lower historical prediction error is not itself a deliverable.

The full product goal remains a championship run, with **98-0 meaning exactly 82-0 plus 16-0**. Phase 5 now implements play-in, playoff series and the championship journey, with [functional validation](PHASE4_PROGRESS.md#current-verification). Title frequency and perfect-run rarity remain **unmeasured**; controlled browser fixtures are not a balance baseline. Do not invent a numerical 98-0 target now. Other IQ modes, Daily, sharing and online features require their own enabled-scope acceptance.

This card does not revoke the existing season-3 release or its accepted exceptions. Existing approved roster expectations remain binding. The strategy targets below are carried forward from [the design](GAME_DESIGN.md#35-calibration-targets) and are now adopted for the next replacement release, together with the playtest thresholds and validation limits. Earlier provisional wording in historical reports does not supersede this approval.

## Release Gates

All four gates must pass for the frozen replacement candidate. A missing measurement is **unmeasured**, not a pass. No averaging a failed gate away with successes elsewhere.

| Gate | Pass Evidence | Current Status |
| --- | --- | --- |
| B1: Basketball credibility | All approved roster bands and required upgrade/downgrade checks pass; one newly approved, unmeasured family panel also passes after candidate freeze. Multiple basketball identities remain viable. | **Not met.** Fit 18 failed 5/9 reserved bands; those families are now exposed. Later accounting studies do not replace this gate. |
| B2: Challenge and agency | Frozen legal-draft policies meet the adopted strategy targets, with a measurable benefit from informed decisions and no unresolved simple exploit. | **Unmeasured for a release candidate.** Earlier policy exceptions and near-universal greedy qualification are not accepted evidence for a replacement. |
| P1: Player experience | The fixed playtest below meets completion, understanding, credibility and voluntary-replay thresholds. | **Unmeasured.** Simulated policy success does not establish enjoyment. |
| E1: Release reliability | Candidate-specific tests, typecheck, build and repeatable desktop/mobile journey checks pass; saves and seeded replay remain compatible. | **Partial.** The latest recorded full [functional validation](PHASE7_PROGRESS.md#validation) passed 112 engine tests, 92 desktop/mobile Edge checks, typecheck and build. This covers the current local product, not a frozen replacement finalist. Comprehensive accessibility/performance, other browsers and physical devices remain unverified; no mode-balance or replacement-candidate acceptance is implied. |

## Difficulty Targets

These concern **achievable legal drafts**, not hand-assembled all-star rosters. In this original scorecard, qualification means at least 60 regular-season wins, not a championship. The [user-requested entry revision](#user-requested-entry-revision) introduced 40-win qualification; the [current revision](#current-qualification-revision) raises new runs to 45. The original qualification-rate targets below must not be silently reused as targets for either different event. Automated policies are reproducible proxies, not labels for human ability.

| Policy | Median Realized Regular-Season Wins | Share Qualifying | Authority |
| --- | --- | --- | --- |
| Random legal picks | 45-55 | 10-20% | Adopted by scorecard approval |
| Competent, chemistry-aware picks | 60-66 | 55-75% | Adopted by scorecard approval |
| Strong optimization within actual rolls | 68-74 | Report; no numerical qualification cap adopted | Adopted by scorecard approval |

Report 75+ wins and 82-0 frequency separately. A median is not an expected-win benchmark, and an 82-0 estimate is not a 98-0 estimate. Zero observed perfect seasons does not establish impossibility. Do not derive or tune a perfect-run rate from a tiny sample.

**Approved measurement contract:** freeze implementations, compute budgets, tie-breaking, coach selection and reroll rules before evaluation. Use the production offer distribution, six picks, eligibility and duplicate protection, with the same permitted information and reroll resources. No policy may inspect future live rolls or outcome draws. Document intentional policy differences so extra access is not presented as decision skill.

Evaluate 1,000 previously unused run seeds per policy, paired by seed across policies and the released baseline. Pair exogenous streams, not an assurance that different actions produce identical draft histories. Store actions, versions and seeds. Report realized win quantiles, mean expected wins, qualification probability and realized qualification, plus paired policy differences. Use run-seed-clustered uncertainty; games within a run are not independent samples.

For qualification proportions use 95% Wilson intervals; for median wins and paired mean differences use 2,000 deterministic run-seed bootstrap resamples. A bounded target passes only when its point estimate and entire interval lie inside its range. A point estimate outside is a fail; an inside estimate with an interval crossing a boundary is inconclusive. Also require a positive lower interval bound for competent-minus-random and optimized-minus-competent mean expected wins. This stricter uncertainty rule is **adopted with this scorecard**, not a retroactive interpretation of earlier approvals.

An inconclusive result permits exactly one additional predeclared 1,000-seed batch, with no model changes and both stages retained. Report the pooled result as a bounded precision check, not a sequentially calibrated 95% test. If still inconclusive, stop; do not keep sampling until it passes. Near-universal success from a simple policy, a repeatable action exploit, or an apparently dominant coach/build requires a written resolution before release, not silent exclusion of that policy.

## Basketball Acceptance

Preserve every approved band and required variant relationship in [the roster review](MID_IQ_ROSTER_REVIEW.md) and its frozen catalog. Evaluate all 24 exposed bases and eight variants as regression evidence, not fresh validation. Required changes include V01/V08 improving, V03/V07 worsening, V04 gaining 2-4 expected wins, and V06 remaining equal within numerical tolerance. Do not impose new directions on V02/V05 or relax bands to rescue a candidate.

Before measuring a finalist, obtain user approval for **six new unmeasured roster families** with exact player versions, coaches, expected-win bands and rationale: star-plus-support, collective defense, traditional interior creation, modern perimeter creation, an exceptional team and a deliberately limited team. Include at least four predeclared meaningful variants. These are coverage categories, not a license to pick convenient rosters or assume statistical independence between shared players. A family is not fresh merely because one player changed.

Freeze candidate code, data, parameters, policy implementations, family membership, targets and evaluation seeds before opening that panel. Use the existing 64-schedule conditional-distribution method and report schedule uncertainty, qualification and season quantiles. All old and new required bands/relationships must pass under the existing band rules; any borderline uncertainty must be disclosed, not rounded away. Verify stored versions and historical missing-data treatment. Dropping unsupported old-era families is not a pass.

Review all 12 coaches across the panel and the represented basketball identities. Do not require identical results or an invented universal coach ranking. Record any suspected dominance, its paired counterexample or explanation, and the user's disposition. Fresh-panel failure blocks promotion; after exposure it cannot be reused as untouched evidence for a revised candidate.

## Player Test

**Approved pilot protocol:** 12 consenting NBA-familiar participants, six with regular strategy-game experience and six casual players. Each gets two uncoached runs on the same frozen candidate, using an assigned, balanced seed list chosen before play, not selected for wins. Normal in-app information and skip controls remain available. Record anonymous observations and counts; no account or personal-data collection is needed.

| Criterion | Approved Pass Threshold |
| --- | --- |
| Complete the experience | At least 10/12 finish their first draft and 82-game result without facilitator help; median active first-run time at most 10 minutes. |
| Understand decisions | At least 10/12 can name a real draft tradeoff from their run and accurately distinguish qualification from a title. |
| Understand outcomes | At least 10/12 can explain that a favored team can lose and that displayed disadvantages are model contributions, not proven causes. |
| Basketball credibility | At least 9/12 rate roster strengths and tradeoffs at least 4/5 after the two runs; record the specific disagreements, not just a score. |
| Want another attempt | At least 8/12 voluntarily make a first pick in a third run during an optional 10-minute free period, without a replay prompt or reward. |
| Critical failures | Zero data-loss, unrecoverable draft, misleading championship claim, or task-blocking input/accessibility failures. |

Use the same neutral questions: "What choice mattered most, and what did you give up?"; "What does this result qualify you for?"; "How could this team lose a game it was favored to win?"; "How well did the roster's strengths and weaknesses match your basketball expectations, from 1 to 5? Why?" Do not coach answers or ask whether the new model is better.

Record seed, actions, qualification outcome, help requests, timing and each answer. Count dropouts as non-completions; disclose recruitment and technical exclusions. Report results by experience group and qualification outcome without fitting to either subgroup. This is a directional usability/fun gate, not a population retention estimate or a statistically powered human skill study. Future human difficulty targets need more data.

## Engineering Acceptance

Run the full engine suite, typecheck and production build against the exact finalist. Automate the enabled draft-to-result journey on desktop and 320px mobile: legal picks/rerolls, start once, pause/advance/skip, overtime, first-loss feedback, final qualification, reload mid-draft and mid-playback, and malformed/legacy-save recovery. Confirm no spoiler state or new simulation draws from playback.

Check touch and keyboard operation, readable/non-color feedback, no overlapping controls, reduced motion, opt-in audio and screen-reader labels. Record environment, commands, results and unresolved limitations. Critical flow, accessibility or save failures block release. Existing historical-score acceptance is preserved unless scores change; any changed scoring system needs its own acceptance evidence. Do not turn the old Phase 4 progress snapshot into a claim that previously accepted scores are still awaiting approval.

## Budget And Stop Rule

1. **Approval recorded.** The user approved revision `mid-iq-scorecard-1` on 2026-09-15 without exceptions. Bounded candidate work may proceed under this contract. Before any new candidate measurements, record its failed gate, hypothesis and configuration grid. Changes to the acceptance targets or budget require explicit approval; candidate selection and fresh-family expectations are not implicitly approved here.
2. **At most two candidate mechanisms.** Each gets one stated failed criterion, one falsifiable hypothesis and a predeclared grid of at most 12 parameter configurations on exposed development data. Any fitted historical choices use earlier years only. Prefer a smaller candidate if added complexity does not address a failed gate. Mechanical test fixes do not create permission to change targets or add configurations.
3. **Choose one finalist.** Freeze it before one fresh-family panel, one policy evaluation (plus the single permitted precision batch), and one 12-person playtest. Gate cheaper checks first; do not recruit people to test a candidate already rejected for basic correctness. Do not rerun failed playtests with different participants until the counts pass.
4. **Ship or stop.** Ship a versioned regular-season release only when B1, B2, P1 and E1 all pass, the user accepts the report, and there are no unresolved blockers. If neither candidate qualifies, a fresh gate fails, or the budget is exhausted, keep live balance and present the failed criterion plus a concrete scope/target/model decision. Another cycle requires explicit approval and new untouched evidence where needed.

Research continues only to address an identified failed gate within that budget. Do not require every historical statistic to be perfectly reproduced, add new success criteria after results arrive, or let favorable accounting diagnostics substitute for actual game acceptance. Do not call a regular-season balance release a completed 98-0 game.

### Integration Authorization

On 2026-09-15, the user approved the recommendation to preserve historical scope and open a **new bounded integration cycle**, recorded in [integration protocol 1](MID_IQ_INTEGRATION_1_PROTOCOL.json). The original two-mechanism cycle remains exhausted. This follow-up allows one missing-data policy and one subsequently frozen complete-strength mapping, with candidate 2's passing weight fixed at 0.25 and no retunes. Gate missing-data validation first; any failed stage stops the cycle. This does not change any roster target, authorize dropping players, approve fresh expectations or approve a replacement release.

**Outcome: stopped at the missing-data gate.** The [frozen result](MID_IQ_MISSING_TURNOVERS_RESULT_1.json) fails registered bias and uncertainty-coverage limits on 117 evaluation players. No historical records were filled and the complete-strength stage was not attempted. An unused downstream stage does not permit another estimator or a retune. Keep live balance; any further model cycle needs explicit approval.

### Exploratory Baseline Study

On 2026-09-15, the user approved exploratory player feedback on the current game with "lets do it". [The baseline playtest kit](BASELINE_PLAYTEST.md) prepares six anonymous sessions, three regular strategy players and three casual players, with two runs and an optional unprompted continuation period. Production build and limited desktop/320px browser checks passed. **No participants have been tested.** This is a product-discovery baseline, not the 12-person frozen-finalist pilot or replacement-release acceptance; it does not change targets, use that pilot attempt or authorize another balance-model cycle. Research remains paused pending actual observations.

## Sign-Off Record

### User-Requested Overload Penalty

On 2026-09-16 the user asked for a harsher over-cap penalty because the 135% cap is already generous. New `season-6` runs use the `mid-iq-3` balance rules: **1.5% offensive efficiency lost per usage point above the threshold, floored at 0.45**, replacing 0.8% and 0.50. The base cap, ball-movement bonus, 40-win entry, coaches, players and opponent pool are unchanged, and `season-1` through `season-5` saves keep their original slope, floor and results. The [design record](GAME_DESIGN.md#a-total-team-usage-rate-usg_team) states the values per rules version.

Because the formula file changed, the frozen offline roster fits recorded against the previous `math.ts` are carried forward by an explicit hash-revision entry in [calibrate-rosters.ts](../src/engine/calibrate-rosters.ts); `mid-iq-1` and `mid-iq-2` evaluation is byte-for-byte unchanged, so those research artifacts were not rewritten or re-fitted. The 81-test suite and typecheck pass, covering the new slope and floor, unchanged legacy modifiers, old/new save recovery and cross-version rejection. This is a direct product change, not a balance-model cycle or release sign-off; no playtest evidence exists for the stricter penalty.

### User-Requested Entry Revision

On 2026-09-15 the user requested a lower qualification requirement grounded in historical averages. New `season-5` runs use **40 wins for play-in entry**, retaining the `season-4` usage cap and all gameplay results. Earlier saves remain unchanged. The [design record](GAME_DESIGN.md#playoff-sliding-scale) specifies the source, normalization, 41-season coverage, 40.1533-win entry proxy, exclusions and limitations. Higher-seed challenge tiers remained unchanged. At that revision, postseason games were not yet implemented; they are now playable, as recorded under Goal And Scope above. Real conference standings are not simulated.

The 79-test suite and production build pass, including exact old/new game-log equality, 39/40 boundaries, incomplete-season rejection, saved 43-win classification under both versions, and tampered qualification rejection. This is a direct product change, not a successful balance-model cycle or full release sign-off. Win-band targets and frozen research remain historical records; new 40-win qualification-rate targets need an explicit decision before future acceptance testing.

### User-Requested Usage Preview

On 2026-09-15, after sharing a 44-38 run, the user requested a higher usage threshold because players enjoy star-studded rosters. A narrowly scoped local gameplay update raises the base cap from 115% to **135% for new `season-4` runs**. Coach bonuses, the overload slope/floor, bench usage weight, scoring-core calculation, defense and score rules remain unchanged. Existing saves retain their original engine and results. This direct product request does not restart the stopped turnover research, relax roster/difficulty targets, or claim all release gates have passed.

Verification: 77 engine tests and production build pass; the updated app restores the user's `season-3` save exactly. A new-run 320px browser journey confirms the coach-adjusted cap, matching simulated efficiency, mid-season reload and 82-game completion without page errors or document overflow. This is limited local-preview verification, not the full E1/P1/B1/B2 acceptance suite. Historical local URL: <http://127.0.0.1:4174> (not a maintained preview).

For the user's exact 134.52%-usage roster, efficiency changes from 0.84384 to 1.0, offense from 95.6352 to 113.3333, and net rating from -5.9583 to +11.7398, with defense unchanged. A diagnostic same-seed replay changes 44 wins to 69, with schedule-conditional expected wins changing from 34.6753 to 63.9951. These are one-roster comparisons, not a target fit or a guarantee; the original completed run was not rewritten. The previous exploratory baseline is a different build and must not be pooled with this preview.

| Item | Current Record |
| --- | --- |
| Scorecard approval / exceptions | Approved by user on 2026-09-15; revision mid-iq-scorecard-1; no exceptions specified |
| Candidate budget used under this contract | 2 of 2 mechanisms used: [candidate 1 turnover shrinkage](MID_IQ_CANDIDATE_1_PROTOCOL.json) rejected; [candidate 2 role-normalized turnover costs](MID_IQ_CANDIDATE_2_PROTOCOL.json) evaluated all five earlier configurations and passed its selected component gate |
| Frozen candidate / source hashes | No complete-game finalist selected. Candidate 2's [earlier-only selection](MID_IQ_CANDIDATE_2_SELECTION.json) and [passing component result](MID_IQ_CANDIDATE_2_RESULT.json) retain source, protocol and implementation hashes; selected passing weight 0.25. Candidate 1 remains rejected. |
| Fresh families / expectation approval | Not created or measured |
| Exploratory current-game feedback | Authorized; [session guide](BASELINE_PLAYTEST.md) and [empty observation record](BASELINE_PLAYTEST_OBSERVATIONS.json) prepared. Limited local technical readiness passed; 0 of 6 human sessions completed. |
| B1 / B2 / P1 / E1 evidence | Pending; use the statuses above, not presumed passes |
| Decision / accepted limitations / release version | Original research cycle exhausted and integration cycle 1 stopped. Current new runs use season-7 / mid-iq-3 / conditional-score-3: 135% base usage plus coach adjustments, 1.5% overload slope with a 0.45 floor, and 45-win entry. Historical players, older saves and frozen reports retain their original scope. No full replacement-release sign-off or further turnover-model cycle approved. Fresh-family, finalist-policy and player tests remain unused. |

Maintain this record as evidence arrives. [The calibration log](MID_IQ_ROSTER_CALIBRATION.md) remains the research history; it is not the release acceptance checklist.
