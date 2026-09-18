# Project 98-0: Game Design

## 1. Executive Summary & Pitch

* **Title:** *98-0* (Working Title)
* **Tagline:** Assemble history's greatest NBA starting five, survive an 82-game gauntlet, and claim the championship ring.
* **Genre:** Sports Roguelike / Drafting Slot Machine / Season Simulator
* **Inspiration:** `82-0.com`, *Wordle*, *Balatro*, *BasketballGM*, *Immaculate Grid*.
* **Core Value Proposition:** Draft history's biggest stars in chemistry-free **No IQ**, the chemistry-aware default **Mid IQ**, or hidden-stats **HI IQ**. The core simulation introduces **Usage Caps**, **Floor Spacing**, **Defensive Roles**, **Coaching Synergies**, and an **Animated Season Ticker with Playoff Run**, with chemistry effects governed by the selected mode (§4).

---

## 2. Core Game Loop

**Current build (2026-09-17):** No IQ, Mid IQ (default), and HI IQ are implemented across drafting, the 82-game season, saved playback and the postseason. The former Classic label is now Mid IQ. Rivalries, matchup previews, overtime reveals, loss explanations and championship/perfect-run results are playable. Local Daily is implemented with Mid IQ fixed at launch. Coach Almanac, 50-run history, per-mode personal bests and image/text sharing with friends are implemented; online rankings remain deferred. The diagram below includes future features as well as the playable core loop. [Current validation](../progress/PHASE7_PROGRESS.md) records 112 engine tests, 92 desktop/mobile browser checks and a passing production build; mode-specific balance and human-playtest acceptance remain separate.

New runs use **`season-7` / `mid-iq-3` / `conditional-score-3`**: 135% base usage plus coach adjustments, a 1.5% overload slope with a 0.45 floor, and 45-win qualification after 82 games. Existing saves retain their pinned rules and results. Historical release measurements below are not new-build balance or player-test acceptance; see [the release scorecard](../release/RELEASE_SCORECARD.md).

```
┌──────────────────────────────────────────────────────────────┐
│ 1. PRE-RUN: Select Coach (Pick 1 of 3 Offered)              │
│    Select Mode (No IQ / Mid IQ / HI IQ)                      │
│    Optional Daily Seed challenge                            │
└──────────────────────────────┬───────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ 2. DRAFT PHASE (6 Rounds: 5 Starters + 1 6th Man)           │
│    • Spin Slot Reel (Team × Era)                             │
│    • Eligible players shown; stats/order follow mode rules   │
│    • Choose Player & Lock Position (from eligiblePositions)  │
│    • 6th Man can be drafted in any round                     │
│    • Live synergy feedback follows selected mode (§4)        │
│    • Mulligans available: 1 Team Reroll, 1 Era Reroll        │
│    • Cannot pass on a spin without spending a reroll         │
└──────────────────────────────┬───────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ 3. REGULAR SEASON SIMULATION (The "Gauntlet")                │
│    • Fast-paced animated 82-game ticker                      │
│    • Event alerts: Rivalry Games, Back-to-Backs, Overtimes   │
│    • Streak status: Can you stay undefeated?                 │
└──────────────────────────────┬───────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ 4. POST-SEASON / PLAYOFF RUN (Sliding Scale Entry)           │
│    • 45 wins = Play-In | 65 = 4 Seed | 70 = 2 | 75+ = 1    │
│    • Best-of-7 series against legendary historical squads    │
│    • Win 16 games to earn the Ring                           │
└──────────────────────────────┬───────────────────────────────┘
                               ▼
┌──────────────────────────────────────────────────────────────┐
│ 5. POST-MORTEM & SOCIAL VIRALITY                             │
│    • Loss Autopsy (Why the streak broke)                     │
│    • Exportable Graphic / Shareable Card                     │
└──────────────────────────────────────────────────────────────┘

```

---

## 3. Core Mechanics & Mathematical Engine

### 3.1. Roster Construction

* **Positions:** PG, SG, SF, PF, C, plus a dedicated **6th Man** bench slot.
* **Player Pool Constraints:**
  * Each player represents a **peak stat line using up to three seasons** for the drafted franchise within the rolled decade. Retain records based on only one or two seasons, using their existing averages without padding missing seasons or adding a short-peak penalty.
  * Show **1-season peak**, **2-season peak**, or **3-season peak** alongside the actual `peakYears` in the draft table and pick details. Derive the label from `peakYears.length`; no separate data field is needed.
  * Peak seasons **may be nonconsecutive**, provided they belong to the drafted franchise within the rolled decade. Preserve the existing selected seasons and stats; list the actual years without implying a continuous span. This continuity decision is adopted for P3.7 without changing the dataset.
  * Players have primary and secondary position eligibility.

#### Draft Rules

| Rule | Resolution |
|------|-----------|
| **Picks per spin** | All eligible players for the Team × Era combo are shown, ordered by overall rating, filterable by position |
| **Position placement** | Binary eligibility via `eligiblePositions` — no out-of-position penalty, allowed or not allowed |
| **Passing** | Cannot pass without a reroll. Must draft from the current spin or spend a reroll |
| **6th Man timing** | Can be drafted in **any round** (not forced to round 6). Choosing the 6th Man early defers a starter slot to a later round |
| **Duplicate protection** | Same Team × Era combo can appear twice. **Same player cannot be drafted twice** (even if available in another team/era combo) |

---

### 3.2. Team Synergy Formulas (The "Anti-Ball-Hog" Fix)

**Mode scope:** The formulas below define **Mid IQ**, the default, and **HI IQ**, which uses the same simulation rules with draft information hidden. **No IQ** disables chemistry while retaining individual scoring, defense and bench quality under §4's approved mapping. Formula examples and §3.5's initial balance targets describe Mid IQ, not universal targets for every mode.

#### A. Total Team Usage Rate ($USG_{team}$)

In real basketball, 100% of possessions must be shared by 5 players. The 6th Man's usage is included at **0.4× weight** (reflecting ~16 min vs ~36 min for starters).

$$USG_{team} = \sum_{i=1}^{5} USG_i + (USG_{6th} \times 0.4)$$

Starting with `season-4`, including current `season-7` runs, the base cap is **135%**, raised from 115% at the user's request on 2026-09-15 to make star-studded rosters more viable. The coach's `usgCap` modifier adds to that threshold. Existing `season-1` through `season-3` saves retain their 115% base cap and original results; start a new run to use the higher cap.

$$\text{effective\_threshold} = 135 + \text{coach.usgCapDelta}$$

**Overload severity (2026-09-16):** at the user's request — 135% is already generous — `season-6` and `season-7` runs (`mid-iq-3` balance rules) charge **1.5% per usage point above the threshold with a 0.45 floor**, replacing 0.8% and 0.50. `season-1` through `season-5` saves keep the original slope and floor, and neither the base cap nor the ball-movement bonus changed.

**Piecewise Efficiency Modifier ($\phi_{usg}$):**

$$\phi_{usg} = \begin{cases} \min(1.03,\; 1.0 + 0.003 \times (95 - USG_{team})) & \text{if } USG_{team} \le 95 \quad \text{(ball movement bonus, max +3\%)} \\ 1.0 & \text{if } 95 < USG_{team} \le \text{effective\_threshold} \quad \text{(optimal range)} \\ \max\left(floor,\; 1.0 - slope \times (USG_{team} - \text{effective\_threshold})\right) & \text{if } USG_{team} > \text{effective\_threshold} \quad \text{(overload penalty)} \end{cases}$$

where $slope = 0.015$ and $floor = 0.45$ for `mid-iq-3` (`season-6` and `season-7`), and $slope = 0.008$ and $floor = 0.50$ for `mid-iq-1` and `mid-iq-2` (`season-1` through `season-5`).

**Example Scenarios** (135% threshold, no coach modifier):

| Roster Type | $USG_{team}$ | $\phi_{usg}$ (`mid-iq-3`) | $\phi_{usg}$ (`mid-iq-2`) |
|-------------|-------------|---------------|--------|
| Role players + 1 star | ~88% | 1.021 | 1.021 |
| Balanced all-stars | ~110% | 1.000 | 1.000 |
| Ball-dominant trio | ~135% | 1.000 | 1.000 |
| 5 prime MVPs | ~155% | 0.700 | 0.840 |
| Nightmare (clamped) | ~200% | 0.450 | 0.500 |

#### B. Spacing Rating ($S_{team}$) — 4-Tier System

Calculated via 3PT Volume ($\text{3PA}$) and Efficiency ($\text{3P\%}$). **Not era-normalized** — 1960s rosters should suffer poor spacing as a meaningful draft tradeoff:

$$S_{team} = \sum_{i=1}^{5} \left( \text{3PA}_i \times \text{3P\%}_i \right)$$

$S_{team}$ represents "expected 3-point makes per game" for the starting five.

**4-Tier Thresholds & Offensive Spacing Modifiers:**

| Tier | $S_{team}$ Range | Offensive Spacing Modifier | Description |
|------|-----------------|----------------|-------------|
| 🔥 **Elite** | $S \ge 10.0$ | +12% | 3+ reliable shooters. Defenses can't pack the paint. |
| ✅ **Good** | $5.0 \le S < 10.0$ | +5% | Adequate spacing. Interior players operate with a boost. |
| ⚖️ **Average** | $2.0 \le S < 5.0$ | 0% | Neutral. No bonus, no penalty. |
| ❌ **Poor** | $S < 2.0$ | −15% | Paint is clogged. Zone defense shreds you. Interior scoring tanks. |

**Asymmetric Penalty — Intentional:** The −15% downside is steeper than the +12% upside. This forces drafting **at least one shooter** or accepting a severe interior scoring penalty. Drafting five non-shooters should feel bad.

**Scope:** The modifier multiplies the whole team ORTG in §3.3, not a separately simulated paint component. Retain the existing tiers and values for the first balance pass; measure whether spacing overwhelms other draft choices before tuning its strength.

**Reference Calibrations:**

| Team Archetype | $S_{team}$ | Tier |
|----------------|-----------|------|
| 5 modern sharpshooters (Curry + Klay + etc.) | ~14–16 | 🔥 Elite |
| Mixed modern team (2 shooters + 3 average) | ~7–9 | ✅ Good |
| 1990s/2000s roster (1 shooter + bigs) | ~3–4 | ⚖️ Average |
| All 1960s–70s roster | ~0.5–1.5 | ❌ Poor |

#### C. Defensive Rating ($DRTG_{team}$)

**Defensive Composite Score (DCS) per Player:**

$$DCS_i = (dbpm_i \times 2.5) + (blk_i \times 1.2) + (stl_i \times 1.8) + (reb_i \times 0.15)$$

All volume stats ($blk$, $stl$, $reb$) are pace-normalized (multiplied by $eraPaceFactor$) before calculation. $dbpm$ is a rate stat and is **not** normalized.

**Pre-DBPM Era Players (pre-1974):**

Steals, blocks, and DBPM were not tracked before 1973-74. For 1960s players, use a **curated defensive tier** mapping:

| Tier | Estimated DBPM | Example Players |
|------|---------------|-----------------|
| 5 — Elite | +5.0 | Bill Russell, Wilt Chamberlain (defensive peak) |
| 4 — Excellent | +3.0 | John Havlicek, Walt Frazier, Nate Thurmond |
| 3 — Good | +1.5 | Jerry West, Oscar Robertson, Willis Reed |
| 2 — Average | 0.0 | Most role players |
| 1 — Poor | −1.5 | Pure scorers with no defensive reputation |

For pre-1974 players who also lack steals/blocks data, use curated estimated values based on historical accounts (e.g., Bill Russell: ~8 BLK, ~1.0 STL; Wilt: ~6 BLK, ~0.7 STL).

**Team DRTG Formula:**

$$\text{Base}_{DRTG} = 110 \quad \text{(league-average defensive rating)}$$

$$\text{rim\_protect} = \max(DCS \text{ among C, PF}) \times 0.5$$

$$\text{perim\_defend} = \text{avg}(DCS \text{ among PG, SG, SF}) \times 0.4$$

$$\text{team\_depth} = \text{avg}(DCS \text{ for all 5 starters}) \times 0.3$$

**Turnstile Penalty — "Absorb One Bad Defender":**

Sort all five $DCS$ values ascending. The **worst defender** (index 0) incurs no extra penalty beyond naturally dragging down the team average. From the **second-worst** onward, any player with $DCS < 0$ triggers an additional penalty:

$$\text{turnstile\_penalty} = \sum_{j=1}^{4} \max(0,\; |DCS_{sorted[j]}|) \times 1.5 \quad \text{where } DCS_{sorted[j]} < 0$$

**Final DRTG (lower = better):**

$$DRTG_{team} = \text{Base}_{DRTG} - \text{rim\_protect} - \text{perim\_defend} - \text{team\_depth} + \text{turnstile\_penalty}$$

**Example Calibrations:**

| Team | DCS Values | DRTG | Interpretation |
|------|-----------|------|----------------|
| Elite D (Russell + Duncan + LeBron + Jordan + Pippen) | [21, 15, 13, 9, 8] | ~97 | Historic defense |
| Good D (1 anchor + decent guards) | [14, 6, 4, 3, 2] | ~104 | Solid |
| Average (1 hidden turnstile) | [8, 4, 2, 0, −2] | ~108 | Manageable |
| Bad D (2 turnstiles) | [6, 2, −3, −4, 1] | ~113+ | Two liabilities = trouble |

---

### 3.3. Game Win Probability Model

#### Team Offensive Rating ($ORTG_{team}$)

**Per-Player Offensive Contribution:**

$$OC_i = (pts_i \times fgPct_i) + (ast_i \times 1.0)$$

All volume stats ($pts$, $ast$) are pace-normalized (multiplied by $eraPaceFactor$) before calculation.

**Team ORTG (higher = better):**

For `season-3` through current `season-7` runs, let $\overline{OC}_{all}$ be the mean of all five starters and $\overline{OC}_{core}$ the mean of the three largest contributions:

$$ORTG_{team} = 95 + 0.20 \times \overline{OC}_{all} + 0.80 \times \overline{OC}_{core}$$

This [scoring-core balance release](../release/MID_IQ_CORE_RELEASE.md) gives complementary star-led rosters a credible qualification chance. All five starters retain positive offensive contribution; the core is selected by contribution, not player identity or position. Existing `season-1` and `season-2` runs retain the original five-player average. All subsequent usage, spacing and game-context calculations remain unchanged.

This produces:
* All-star team: ~115 ORTG (elite)
* Average team: ~105 ORTG
* Bad construction: ~100 ORTG

#### Full Net Rating Pipeline

For each game $k \in [1, 82]$ against opposing benchmark team $Opp_k$:

$$\text{Effective}_{ORTG} = ORTG_{team} \times \phi_{usg} \times (1 + \text{SpacingModifier})$$

$$NetRating_{team} = \text{Effective}_{ORTG} - DRTG_{team}$$

$$\Delta Rating = NetRating_{team} - NetRating_{Opp_k} + \text{FatigueMod} + \text{HomeCourtBonus} + \text{DepthBonus} + \text{CoachPaceMod}$$

The win probability $P(Win)$ is computed via a logistic sigmoid function:

$$P(Win) = \frac{1}{1 + e^{-\frac{\Delta Rating}{\sigma}}}$$

#### Fixed Game Parameters

| Parameter | Value | Justification |
|-----------|-------|---------------|
| $\sigma$ (sigmoid width) | 10.5 | +10 Net Rating advantage → ~72.2% single-game win probability |
| HomeCourtBonus | +3.0 Net Rating | NBA historical home court ≈ 3 points |
| Home/Away split | 41 home / 41 away | Standard NBA schedule |
| B2B Fatigue | −8 to −1 (scaled by 6th Man quality) | See §3.4 |
| CoachPaceMod | Coach's `pace` modifier value | See §6 Coaching |

#### Chosen Score and Event Model (Phase 3)

**Decision:** Use an **outcome-first, conditional-score model**: choose the winner once, generate a matchup-conditioned margin and shared scoring baseline, and retain explicit overtime records. This is a game-level simulation, not a possession or box-score simulation. New runs use `season-7` / `conditional-score-3`, retaining the score parameters accepted after [15/15 held-out calibration checks](../research/phase3/PHASE3_SCORE_RETRY.md). The [season-3 scoring-core release](../release/MID_IQ_CORE_RELEASE.md) and later usage revisions change win ratings, not those score parameters. Existing `season-1` through `season-6` saves retain their pinned balance, entry rules, scores and results; original v1 measurements remain in [the Phase 3 baseline](../research/phase3/PHASE3_BASELINE.md).

1. **Winner:** Let $p$ be `evaluateGame`'s win probability, including all game-day adjustments. Draw a seeded uniform value $U$ in $[0, 1)$ and set `won = U < p`. This is the final winner, including overtime. Score generation, rounding, events, and playback must never change it or apply home court, coach, depth, or fatigue adjustments again.
2. **Margin:** For regulation finishes, use a logistic signed-margin distribution conditioned on a positive margin for a user win or a negative margin for a loss. Released score scale is $s = 8$, with center $\Delta Rating \times s / 10.5$; the win-probability sigmoid remains unchanged at $\sigma = 10.5$. Sample within the selected side, not by drawing an unconditional margin and flipping its sign. Round the sampled magnitude, add one, and cap at 100 points while preserving the selected winner. Legacy v1 retains scale 10.5, zero rounding offset, a minimum of one, and a 70-point cap.
3. **Score level:** Independently sample a shared modern, era-normalized scoring baseline, then construct nonnegative integer scores around it with the selected margin. The released per-team baseline is `round(113.445132 + 24.044916 * (U1 - U2))` using two independent uniform draws. Enforce score/margin consistency by construction rather than rounding two independent team scores. Opponent Net Rating alone does not establish separate offensive, defensive, or pace profiles; do not invent those distinctions. P3.7's accepted calibration and tail limitations are recorded in the second-attempt report.
4. **Overtime:** Use a separate seeded draw with released probability $P(OT) = 0.052149 \times 4p(1-p)$, highest for an even matchup and lower for mismatches. Legacy v1 retains a 0.06 maximum. An overtime game must have tied regulation scores and stored overtime scoring increments ending with the already-selected winner. The released conditional OT margin uses the selected-side rating difference times `5/48`, logistic scale 3, rounded magnitude with a minimum of one and cap of 30. Each period baseline is `round(9.477421 + 6 * (U1 - U2))`; continuation probability is 0.119403 with a six-period safety cap. These guardrails are not estimated historical maxima, and period-level realism remains a documented limitation. Do not reroll the winner when entering another period. Every period before the last must end tied, and final scores must equal regulation scores plus all overtime increments.
5. **Events:** Initially support facts established by the result, such as overtime and a one-point finish. **True buzzer-beaters are deferred** until a consistent final-shot event is generated and stored. A close margin alone is not evidence of a buzzer-beater. No fabricated shooting percentages, turnovers, or player box-score claims may appear in the loss autopsy.
6. **Reproducibility:** Store the sampled outcome, final scores, regulation scores, overtime periods, probability, and rating context. Score and event draws belong to versioned simulation randomness, separate from cosmetic randomness. Pin scoring distributions, rounding/bounds, overtime rules, and random-draw order alongside the engine version: point differential affects Daily rankings and is not merely presentation.

**Probability contract:** Because the winner is sampled once and every subsequent path preserves it, the final marginal win probability remains $p$, including overtime. Overtime frequencies and score distributions are separate calibration targets; preserving win probability does not by itself validate their realism.

**Required validation:** Cover wins and losses at even, favored, and underdog probabilities; seeded replay; finite nonnegative integer scores; non-tied finals matching `won`; exact score differences; tied regulation for overtime; period sums; and no result changes from playback. Measure win rates against the input probabilities and inspect margin, score, and overtime distributions before accepting balance baselines.

---

### 3.4. Fatigue & The 6th Man Mechanic

#### 6th Man Quality Score

$$QS_{6th} = (pts_{6th} \times fgPct_{6th}) + (ast_{6th} \times 0.5) + \max(0, dbpm_{6th}) \times 1.0$$

**Implemented correction:** Positive DBPM helps bench quality; negative DBPM contributes zero rather than becoming a reward through its absolute value. Apply coach adjustments before this calculation. Runtime and regression tests now use this correction, including the first Phase 3 measurements.

$$QS_{MAX} = 20.0 \quad \text{(calibrated so elite 6th Men like Ginóbili, Harden '12 hit } \approx 1.0\text{)}$$

$$FRF = \max\left(0,\; \min\left(1.0,\; \frac{QS_{6th}}{QS_{MAX}}\right)\right) \quad \text{(Fatigue Reduction Factor, 0 to 1)}$$

#### Back-to-Back Fatigue (Quality Scaled)

* Exactly **14 non-overlapping back-to-back pairs** per regular season, with placement randomized using the saved schedule seed. Each pair represents two games on consecutive days: 28 games belong to pairs, but only **14 second legs receive fatigue**.
* Apply the existing B2B penalty only to the **second game** of each pair. `isBackToBack` means a fatigued second leg, not either member of the pair. Game 1 may start a pair but must always have `isBackToBack = false`.
* Construct the schedule by shuffling **14 two-game blocks and 54 single-game blocks**, then expanding them into 82 game slots. Include at least one rest day between blocks; consecutive ticker entries are not necessarily consecutive calendar days. No three-games-in-three-days stretches are allowed.
* Randomize block placement independently of opponent strength and home/away assignments. Do not target difficult opponents with fatigue. Preserve the opponent-tier counts and 41 home/41 away split in §5 and §3.3.
* Store pair membership/leg information and rest spacing (such as relative day indices) so the schedule can be validated and explained. Seeded replay must reproduce the same placement.
* Only B2B fatigue applies: overtime, travel, and rivalries do not add fatigue or cause it to accumulate. These placement rules cover the regular season. The postseason has no B2Bs or fatigue carryover; the permanent bench bonus still applies.

**Schedule validation:** Require 82 games, 14 disjoint consecutive-day pairs, exactly 14 fatigued second legs, no fatigue on Game 1 or first legs, rest between blocks, and identical placement on seeded replay. Cover pairs at the beginning and end of the season and adjacent two-game blocks separated by rest.

$$\text{B2B\_penalty} = -8 + (7 \times FRF)$$

| 6th Man Quality | FRF | B2B Penalty |
|----------------|-----|-------------|
| Elite (Ginóbili, Harden '12, McHale '84) | ≈ 1.0 | −1 |
| Average bench player | ≈ 0.5 | −4.5 |
| No / weak 6th Man | ≈ 0.0 | −8 |

#### Permanent Depth Bonus

The 6th Man now contributes to **every game**, not just back-to-backs:

$$\text{DepthBonus} = FRF \times 2.0 \quad \text{(max +2.0 Net Rating from bench depth)}$$

This is added to $\Delta Rating$ for every game in the season.

### 3.5. Calibration Targets

**Next balance-release contract:** [The release scorecard](../release/RELEASE_SCORECARD.md), approved on 2026-09-15, adopts the strategy targets below, player-test gates and a bounded validation process for the next replacement release. It supersedes their earlier provisional status for that scope without changing the released rules or approving a replacement model.

**Historical scoring-core release (2026-09-14):** The user adopted "a roster like this usually contend for qualification." That release introduced `season-3` / `mid-iq-2` balance with unchanged `conditional-score-3` score rules. The [release report](../release/MID_IQ_CORE_RELEASE.md) records the single offense change, 1,240 fresh legal redrafts and compatibility policy. At the then-current 60-win cutoff, the reference roster improves from 53.94 expected wins / 8.66% qualification to 60.05 / 56.32%; its same-seed result is 57-25, not a guaranteed qualification. These are historical measurements, not current `season-7` outcomes. The original targets and unresolved exceptions below remain visible; this is not comprehensive balance or playoff acceptance.

These are **adopted targets for the next replacement release, not measured results**, following the scorecard approval above. Evaluate reproducible draft strategies across many saved seeds, respecting actual coach offers, rolls, rerolls, eligibility, and duplicate protection. Do not substitute unrestricted all-star rosters for achievable drafts.

**Mid IQ v1 acceptance (2026-09-14):** V1 balance was approved with documented exceptions for random play and bounded optimization, as measured in the [P3.7 review](../research/phase3/PHASE3_REVIEW.md). The original targets below remain visible for Phase 9 review; approval does not mean all targets passed or authorize changes to win probabilities. Historical score calibration was separately accepted after the [second attempt](../research/phase3/PHASE3_SCORE_RETRY.md); its score-only release leaves these win probabilities unchanged.

| Draft Strategy | Median Regular-Season Wins | Share Reaching 60 Wins |
| --- | --- | --- |
| Random legal picks | 45–55 | 10–20% |
| Competent, chemistry-aware picks | 60–66 | 55–75% |
| Strong optimization within actual rolls | 68–74 | Measure; 75+ wins should be a standout result |

**Current qualification scope:** The table's percentages concern **60+ wins**, not current 45-win entry. `season-5`/`season-6` reports at 40 wins and earlier reports at 60 wins retain their original meaning. No replacement qualification-rate targets for 45-win entry have been adopted. The current usage and entry revisions do not establish a new balance or human-playtest sign-off; replacement-release gates remain outstanding in [the scorecard](../release/RELEASE_SCORECARD.md).

Define and version each strategy before measuring it; report sample sizes and uncertainty alongside win distributions and qualification rates. Keep sigma 10.5, qualification thresholds, and the whole-offense spacing tiers unchanged for the first measurement pass, after applying §3.4's bench-defense correction. Compare balanced, overloaded, non-shooting, defensive, and bench-heavy builds, all coaches, and eras. Tune only against evidence and version changes affecting replay. Measure title and perfect-run frequency once playoffs exist; do not force a specific 98-0 frequency before observing the baseline. Score and overtime distributions remain separate calibration work under §3.3.

---

## 4. Game Modes

There are **three implemented IQ modes**. **Mid IQ is the default** and replaces the previous name "Classic". **HI IQ** is the hidden-stats mode inspired by **HoopIQ from 82-0**; HoopIQ is not an additional mode. Select the mode before signing a coach; it then stays locked for that run.

Each actual mode change starts a fresh seeded draft and reshuffles coach offers. With at least three alternative coaches, none of the immediately previous offers are reused; smaller pools require a different offer set. Clicking the active mode or reloading does not reshuffle. This prevents direct mode-toggle inspection of the same offers, not remembering coach attributes from earlier runs or inspecting local data.

| Mode | Chemistry in Simulation | Information Before Simulation | Player Goal |
| --- | --- | --- | --- |
| **No IQ** | Arcade mode. No chemistry stats, bonuses, or penalties affect the simulation. Individual player quality still matters. | Player stats and ratings are visible; chemistry feedback is disabled, not presented as an active modifier. | Build the best team possible with the biggest stars, without worrying about team chemistry. |
| **Mid IQ** | Full team chemistry using the rules developed in §3. This is the default mode. | Player stats, ratings, and live chemistry feedback are visible. | Balance star power with usage, spacing, defense, and coaching fit. |
| **HI IQ** | Same chemistry and simulation rules as Mid IQ; difficulty comes from hidden information, not harsher penalties. | Stats, ratings, chemistry meters, and coaching numbers stay hidden until simulation starts, including on the completed-draft preview. | Draft using basketball knowledge, following the HoopIQ-style experience from 82-0. |

### Chemistry and Visibility Contract

* **No IQ (approved mapping, 2026-09-16):** Keep the existing era-normalized individual offensive contributions and core-offense aggregation. Set usage/ball-movement multiplier to 1 and spacing modifier to 0. Ignore all coach stat, usage-cap and pace modifiers. Replace position-dependent rim/perimeter weighting and nonlinear liability penalties with `DRTG = 110 - 1.2 * mean(individual defensive composite of five starters)`; 1.2 preserves the combined baseline defensive weights (0.5 + 0.4 + 0.3) for equal defenders without position-fit effects. Retain uncoached sixth-man quality, permanent depth strength and B2B fatigue relief as individual bench ability, not chemistry. Home court, schedule fatigue, opponent difficulty and postseason seed bonuses remain unchanged. Feedback must identify chemistry as disabled and must not blame disabled effects.
* **Scope decision:** Low IQ was removed on 2026-09-16. Only No IQ, Mid IQ and HI IQ are offered.
* **Mid IQ:** Preserve the current chemistry design as the baseline. Earlier references to the implemented "Classic" draft describe this baseline, not an additional mode.
* **HI IQ:** Use Mid IQ's engine rules and random draws. For identical lineup, coach, seed, and game context, Mid IQ and HI IQ must produce identical results. Reveal protected stats only when the player starts simulation, never simply because the sixth pick is complete. Before that transition, hide numeric and qualitative proxies in tables, tooltips, accessible labels, coach descriptions, sorting, and previews. Names and eras remain visible; legal position eligibility can remain visible to support drafting, but must not expose ratings or chemistry.
* **Shared rules:** All three modes retain coach offers, the six-player roster, legal positions, duplicate protection, and rerolls. Ordinary runs allow unlimited retries. Mode selection locks at coach signing and persists through season/playoffs and resumes; future history/share features must retain it too. New runs default to Mid IQ. Loss autopsies use actual effects and never blame disabled chemistry in No IQ.
* **Compatibility:** New runs pin `iqMode` (`no`, `mid`, `hi`) and `iqVersion: iq-1`. No IQ uses `no-iq-1` through the mode-aware math wrapper; Mid IQ/HI IQ delegate to the unchanged baseline. Saves without mode metadata remain Mid IQ under their existing engine versions without rewriting results. Unknown modes/versions and completed results inconsistent with the selected mode are rejected. Older engine drafts cannot switch modes. This is local validation, not tamper-proof ranking infrastructure.

### Challenges and Postseason

Daily Seed and Playoff Gauntlet are not additional IQ modes:

| Format | Rules & Constraints | Purpose |
| --- | --- | --- |
| **Daily Seeded Run** | Shared UTC challenge and offer priorities, with deterministic legal fallbacks. Launch mode is Mid IQ, selected by the user on 2026-09-16 and pinned alongside seed/rules. One attempt per UTC day in this browser, including cancelled or abandoned attempts; different IQ modes cannot share a ranking. | Local challenge; trusted competition remains Phase 8. |
| **Playoff Gauntlet** | Sliding scale entry (see below). Best-of-7 series versus legendary squads, retaining the run's selected IQ mode. | End-game progression in all three modes. |

### Daily Fairness and Ranked Attempts

**Social scope (2026-09-17):** Sharing results with friends is the current social direction, using Phase 7 image cards, plain text, downloads and browser share/copy actions. Accounts, server-verified attempts and public leaderboards are deferred to Phase 8 as an optional future improvement, not current release requirements. The ranked-attempt rules below are retained for that future scope. The browser-local single-attempt update is deployed; existing saves remain readable. See [current status](../STATUS.md).

* **Indefinite rotation (restarted 2026-09-17):** New `daily-3` runs use the 56 distinct themes in [the versioned calendar](../../src/engine/daily-calendar.ts), all in Mid IQ. `rotation-1` starts **September 17, 2026 UTC**, reshuffling all 56 themes once per cycle, including cycle zero. A deterministic boundary swap prevents the previous cycle's last theme from appearing first. Themes recur with fresh date-specific seeds; there is no expiry or player-specific cycle counter. The dialog shows the current cycle. Identical app/data/rotation versions and UTC dates agree offline once loaded, independent of timezone or skipped days; device clocks are not trusted. This does not implement offline installation/caching. The old published schedule is retired for new starts but preserved for `daily-2` save replay, alongside unrestricted `daily-1` saves. Any recorded same-day commitment, including legacy versions, consumes that UTC day's attempt. See [implementation and verification](../progress/PHASE6_PROGRESS.md).
* Fixed-coach days provide only that coach to sign; other days retain three offers. Era/franchise restrictions apply throughout rolls, rerolls and picks. Fixed-player days begin with one or two exact records locked in their assigned slots, leaving five or four picks; duplicate-person protection applies across all franchise/era versions. Locked players are explicit exceptions to restrictions on remaining picks, such as Lakers Kobe with a Charlotte pool. Invalid duplicate identities or slots are rejected. The next roll retains the existing occupied-slot round number.
* Stat-filter days use **raw, uncoached, non-normalized player-record averages**, not career totals or coach-adjusted values: PPG < 20, USG% <= 20, 3PA < 1, or USG% >= 25. No Refunds begins with zero team and era rerolls. The centers-only challenge locks Raptors 2020s Scottie Barnes at PG and restricts remaining picks to C eligibility while keeping normal slot eligibility; C eligibility includes versatile guards/wings, not only traditional centers. Without the locked PG, the pool can run out of PG-eligible identities. Every published pool passes a conservative distinct-player position-coverage guarantee after any legal choices. Single-era days keep an unavailable era reroll unspent rather than converting it into a different token. Simulation rules are unchanged; historic themes are not exact historical roster reconstructions.
* Pin the shared seed to the UTC challenge date and engine/data versions, plus calendar version and challenge identity for themed runs. Everyone receives the same coach offer(s) and per-round franchise/era priority lists within the allowed pool, including action-specific reroll lists. Select the first legal option, preserving the opposite reel on a reroll; a reroll must change its axis. If no legal alternative exists, the token remains unspent. Earlier choices may require different fallbacks. Describe this as **the same challenge and offer priorities**, not identical offers regardless of choices. Existing `daily-1` saves and results retain their original unrestricted rules and seeds.
* Address priority lists by round and action, and keep draft, schedule, game-resolution, and cosmetic random streams separate. Different draft actions must not shift schedule or game-resolution draws. Identical versions, dates, and action sequences reproduce identical runs; differing lineups can produce different outcomes from shared random draws.
* Allow **one ranked attempt per authenticated account per UTC challenge date**, committed server-side before coach offers are revealed. Abandoning does not grant another ranked attempt. Refresh resumes that same attempt; changing the UTC date never replaces an active run.
* A ranked attempt must start during its challenge day. Allow a **24-hour completion/submission grace period after that UTC day ends**, with server receipt before the grace deadline required for ranking. Late or offline results received after that deadline remain playable locally but unranked. Keep the original pinned versions for resumes.
* Daily has no repeat starts: commit one attempt per UTC date in the current browser before revealing offers. Cancelling or abandoning consumes the day; unfinished saves can resume, and the next Daily unlocks at 00:00 UTC. Guests may play all three IQ modes and local Daily without sign-in. Browser storage and device time cannot enforce trusted attempts or deadlines; public ranked competition requires Phase 8's server validation. One account per attempt is not proof of one human per attempt.

### Rankings and Local Progression

**Future rankings only:** The next two paragraphs define the deferred Phase 8 contract. Sharing and informal comparison with friends do not require ranked accounts or server validation. Local progression remains in the current Phase 7 scope.

Rank each Daily challenge by **regular-season wins**, then **regular-season point differential**, then **longest regular-season winning streak**, all descending. All entries compare the same 82-game workload. Exact ties share rank; submission speed is not a tiebreaker. Play-in and playoff records and championships appear as separate badges, never additional ranking wins.

Use a stable authenticated account ID for ranked identity, with a changeable display name. Validate the attempt and legal action history by server replay with pinned rules/data, not client-supplied totals. Submit the regular-season ranking when those 82 games finish; postseason progress is separate and does not delay that submission or change its rank.

Unlock the entire Coach Almanac after the first completed 82-game season, regardless of wins. Persist unlocks independently of active saves. Retain the **50 most recent completed runs plus personal-best summaries** locally, including mode, coach, lineup, regular-season and postseason records. New drafts must not erase progression. Local achievements are not verified rankings.

### Playoff Sliding Scale

**Current entry revision (2026-09-16):** at the user's request, new `season-7` runs require **45 wins**, replacing 40. After all 82 games, fewer than 45 wins misses qualification and 45–64 wins is classified as play-in entry. Higher seed thresholds are unchanged. This revision preserves `season-6` ratings, usage, scores and seeded game results; it changes only qualification classification. Phase 5 now provides a Start Postseason action after regular-season playback completes.

**Historical entry revision (2026-09-15):** `season-5` introduced **40-win** entry, retained by `season-6`, replacing 60. The local [team standings](../../data/raw/Team%20Summaries.csv) contain 41 usable NBA seasons from 1984 through 2024 with exactly 16 teams marked `playoffs=TRUE`. For each team, normalize wins to `82 * w / (w + l)`; average the two lowest playoff-team totals within each season, then average seasons. The result is **40.1533 wins**; all playoff teams average **49.8354**. The former is an entry-level proxy, not an exact conference cutoff or a historical play-in estimate. Seasons 2025 and 2026 lack a complete set of playoff flags and are excluded. Conference differences, tiebreakers and historical format changes mean real qualification is not determined by a fixed win total.

The historical 40-win cutoff rounded that entry proxy; the current 45-win cutoff is a subsequent user-requested product decision, not a new historical estimate. Higher-seed tiers below remain game challenge rewards, not historically calibrated seed cutoffs. Saved `season-1` through `season-4` runs retain 60-win entry; `season-5` and `season-6` retain 40-win entry. Start a new run for 45-win entry. Frozen reports retain their original thresholds and are not validation of this revision.

The table uses current `season-7` entry thresholds. Classification, home sequences, extra postseason NR and game progression are implemented. Qualifying older saves retain their original entry thresholds and can start the postseason without rewriting their regular-season results.

| Regular Season Wins | Entry | Best-of-Seven Home Sequence | Extra NR |
| --- | --- | --- | --- |
| Below 45 | Eliminated | None | None |
| 45–64 | One away play-in game | After winning: A–A–H–H–A–H–A | 0 |
| 65–69 | 4th Seed | A–A–H–H–A–H–A | 0 |
| 70–74 | 2nd Seed | H–H–A–A–H–A–H | 0 |
| 75–81 | 1st Seed | H–H–A–A–H–A–H | +1 on home games |
| 82-0 | 1st Seed | H–H–A–A–H–A–H | +2 on home games |

H/A are from the user's perspective and reset for each series. Home-court advantage means the favorable sequence, not every game at home. Retain the standard +3 NR at home and zero away; the listed bonus stacks only at home, with +2 replacing +1 for an undefeated season.

Represent entry explicitly as missed, play-in, fourth seed, second seed, or first seed; do not invent a numeric seed for play-in. The play-in is one sudden-death away game: lose and the run ends, win and enter four best-of-seven series, each ending at four wins or four losses. Play-in wins do not count toward the **16 main-bracket wins** required for a ring. Keep regular-season, play-in, and playoff records distinct. **98-0 means exactly 82-0 plus 16-0**, with no play-in involved.

All postseason games have rest: no B2Bs, no fatigue carryover, and no overtime/travel fatigue. The permanent bench bonus and coach effects still apply once per game.

### Playoff Opponent Generation

* Use the existing **five round-specific groups: 20 entries representing 17 distinct historical squads**. Draw and save a complete valid opponent path for the applicable rounds with no repeated exact squad, including the play-in when required. Different seasons of one franchise may appear; identity is the exact historical squad, not franchise alone. Validate that a complete path exists before starting rather than falling back to a duplicate if a greedy draw reaches a dead end.
* Opponents get **stronger each round** via a difficulty multiplier on their Net Rating:

| Round | NR Multiplier | Example Opponents |
|-------|--------------|-------------------|
| Play-In (if applicable) | ×0.90 | '94 Knicks, '04 Pistons, '21 Warriors |
| Round 1 | ×1.00 | '11 Mavericks, '95 Rockets, '03 Spurs |
| Round 2 | ×1.05 | '86 Celtics, '01 Lakers, '14 Spurs |
| Conference Finals | ×1.10 | '17 Warriors, '96 Bulls, '87 Lakers |
| Finals | ×1.15 | '96 Bulls, '17 Warriors, '71 Bucks |

Reuse the regular-season outcome-first model with the home sequences above. Apply the round multiplier once to the opponent's benchmark Net Rating. Keep draws and results stable across refreshes. Validate every entry threshold, both home sequences, home-only bonuses, no-repeat paths, play-in elimination, four-win series termination, and separate ring/perfect-run accounting.

---

## 5. Regular Season Opponent Generation

### Tiered Opponent Pool

A pool of **~30 historical benchmark teams** representing different quality tiers:

| Tier | Count | Net Rating Range | Examples |
|------|-------|-----------------|----------|
| **Contender** | 6 | +8 to +14 | '96 Bulls (+13.4), '17 Warriors (+11.6), '86 Celtics (+9.2) |
| **Playoff** | 10 | +2 to +8 | '03 Spurs (+5.9), '11 Mavs (+4.7), '14 Pacers (+4.8) |
| **Average** | 10 | −1 to +3 | '95 Nuggets (+0.9), '18 Wizards (+0.6), '08 76ers (+0.4) |
| **Lottery** | 6 | −15 to −3 | '12 Bobcats (−15.2), '16 76ers (−10.4), '05 Lakers (−3.3) |

Each 82-game schedule randomly samples from this pool:
* ~15 games vs Contenders
* ~25 games vs Playoff teams
* ~30 games vs Average teams
* ~12 games vs Lottery teams

> **Validated:** Opponent teams and Net Ratings compiled from Basketball-Reference historical data (2026). Lottery tier uses a hybrid mix of 2 extreme tankers and 4 mild lottery teams for variance.

### Rivalry Meaning (Narrative Only)

**Decision:** Derive rivalry alerts from a curated list of historical franchise pairs, matching the opponent's canonical franchise against the **drafted franchise version** of any of the six players, including the sixth man. The mixed-franchise roster has no single team identity. Match pairs symmetrically using canonical franchise IDs, not display-name parsing.

* For example, a Lakers version of Magic Johnson facing a Celtics benchmark may produce "Historic rivalry: Lakers vs. Celtics," identifying Magic as the Lakers representative. This describes a franchise rivalry, not a claim that the selected player personally faced that historical squad.
* Rivalries are **narrative-only**: no rating bonus, fatigue change, altered win probability, score adjustment, or extra random draw. Never alter the schedule to force rivalry games.
* Do not infer personal grudges, former-team history, or era-specific feuds from names alone. Only reviewed franchise pairs may trigger a label. The implemented `rivalry-1` list contains BOS/LAL, CHI/DET, IND/NYK, MIA/NYK, BOS/PHI and LAL/SAS. New runs pin this version; older saves without rivalry metadata are not retroactively annotated.
* Store the matching franchise pairs and supporting drafted player IDs with the game record. Deduplicate pairs and player IDs, use stable ordering, and combine multiple matches into one game alert. Preserve the supporting evidence in game details.
* Rivalry annotation must be deterministic from the frozen lineup, opponent, and versioned rivalry list. Adding, removing, or hiding an alert must not consume simulation randomness or change any game outcome.

**Required validation:** Cover both pair directions, sixth-man matches, multiple matching players/pairs, no-match cases, and a different franchise version of the same player. Confirm annotations retain their evidence on reload and leave the schedule, probabilities, scores, and random state unchanged.

---

## 6. Coaching System

### Coach Selection

At the start of each run, the player is offered **3 randomly selected coaches** from a pool of 12. Choose 1. The "Coach Almanac" unlocks all 12 systems after the first completed 82-game season, regardless of wins, and remains unlocked across new runs (§4). Almanac and history access are temporarily blocked during HI IQ drafting until Start Season. [Implementation and validation](../progress/PHASE7_PROGRESS.md).

### Coach Modifier Interface

Each coach has **buffs and debuffs** (every coach has at least one tradeoff):

| Stat Key | Application | Example |
|----------|-------------|---------|
| `threePtPct` | Added to each player's 3P% → affects Spacing calc | +0.04 = each player gains 4 percentage points |
| `fgPct` | Added to each player's FG% → affects ORTG calc | +0.03 = each player gains 3 percentage points |
| `dbpm` | Added to each player's DBPM → flows into DCS → DRTG | +0.5 = each player's DCS improves by 1.25 |
| `pace` | Direct addition to team Net Rating every game | +2.0 = +2 points to Net Rating |
| `usgCap` | Raises the usage threshold before penalties apply | +5 = threshold moves from 135% to 140% in `season-4` through `season-7`; `season-1` through `season-3` retain 115% to 120% |

In `season-6` and `season-7` runs every point past that threshold costs 1.5% offensive efficiency, so a `usgCap` coach is worth more than in earlier versions.

### Coach Roster (12 Coaches)

| # | Coach | System | Buffs | Debuffs | Design Intent |
|---|-------|--------|-------|---------|---------------|
| 1 | **Phil Jackson** | Triangle Offense | +0.03 `fgPct`, +3 `usgCap` | −1.0 `pace` | Half-court execution; punishes run-and-gun |
| 2 | **Mike D'Antoni** | Seven Seconds or Less | +0.04 `threePtPct`, +2.0 `pace` | −0.5 `dbpm` | Pace-and-space specialist; defense suffers |
| 3 | **Gregg Popovich** | Spurs System | +5 `usgCap`, +0.3 `dbpm` | −1.5 `pace` | Ball movement master; slow, methodical |
| 4 | **Pat Riley** | Showtime → Grind | +0.5 `dbpm` | −0.02 `threePtPct` | Elite defense; spacing slightly worse |
| 5 | **Steve Kerr** | Motion Offense | +0.05 `threePtPct`, +3 `usgCap` | −0.3 `dbpm` | Best 3PT coach; mild defensive cost |
| 6 | **Chuck Daly** | Bad Boys Defense | +0.8 `dbpm` | −0.03 `threePtPct` | Defensive identity; offense grinds |
| 7 | **Red Auerbach** | Fast Break Celtics | +2.5 `pace`, +0.02 `threePtPct` | −0.3 `dbpm` | Tempo pusher; transition over halfcourt D |
| 8 | **Don Nelson** | Nellie Ball | +3.0 `pace`, +0.03 `threePtPct` | −0.6 `dbpm` | Most extreme pace; defense is optional |
| 9 | **Larry Brown** | Grit Defense | +0.6 `dbpm` | −2.0 `pace` | Slowest coach; best pure defensive buff |
| 10 | **Erik Spoelstra** | Modern Versatility | +0.3 `dbpm`, +0.02 `threePtPct` | −0.5 `pace` | Balanced; slight tempo cost |
| 11 | **Jerry Sloan** | Jazz System (PnR) | +4 `usgCap`, +0.02 `threePtPct` | −0.2 `dbpm` | Accommodates ball-dominant PG; slight D cost |
| 12 | **Rick Adelman** | Princeton / Corner 3 | +0.03 `threePtPct`, +3 `usgCap` | −1.0 `pace` | Motion-heavy; slow but efficient |

---

## 7. Era Pace Normalization

### Formula

$$eraPaceFactor = \frac{\text{modernBasePace}}{\text{eraAveragePace}} \quad \text{where modernBasePace} = 100$$

### Lookup Table

| Decade | Avg Pace (est.) | eraPaceFactor | Effect |
|--------|----------------|---------------|--------|
| 1960s | 126 | 0.794 | Stats deflated ~21% (Wilt's 50 PPG → ~40 PPG equivalent) |
| 1970s | 106 | 0.943 | Mild deflation ~6% |
| 1980s | 101 | 0.990 | Near-neutral |
| 1990s | 93 | 1.075 | Stats inflated ~8% (slow-era bump) |
| 2000s | 91 | 1.099 | Stats inflated ~10% |
| 2010s | 95 | 1.053 | Slight inflation ~5% |
| 2020s | 100 | 1.000 | Baseline (no change) |

### What Gets Normalized

| Normalized (× eraPaceFactor) | NOT Normalized |
|------------------------------|----------------|
| PTS, REB, AST, STL, BLK, 3PA | FG%, 3P%, USG%, DBPM |

**Spacing exception:** The general normalization helper scales 3PA, but the spacing calculation in §3.2.B deliberately uses raw 3PA. No era-based shooting adjustment is applied. Sixth-man quality uses pace-normalized PTS and AST, with FG% and DBPM left as rate stats.

---

## 8. Technical Data Models & TypeScript Interfaces

**Implementation boundary:** The interfaces below describe the design contract, not a complete current save schema. Runtime [types](../../src/engine/types.ts) provide season and postseason results, individual series/games, rivalry evidence and stored rating context; [RunSave](../../src/engine/run.ts) adds versioned draft actions, frozen inputs, optional legacy-compatible `iqMode`/`iqVersion`, Daily attempt metadata, and postseason/rivalry metadata. The store persists separate regular-season and postseason [playback state](../../src/engine/playback.ts). [Daily records](../../src/engine/daily.ts) persist independently of active saves. The proposed `SimulationResult` interface is not the runtime shape; general history remains pending.

```typescript
export type Position = 'PG' | 'SG' | 'SF' | 'PF' | 'C' | '6TH';

export type EraDecade = '1960s' | '1970s' | '1980s' | '1990s' | '2000s' | '2010s' | '2020s';

export interface PlayerStats {
  pts: number;
  reb: number;
  ast: number;
  stl: number;
  blk: number;
  fgPct: number;
  threePtPct: number;
  threePtAttempts: number;
  usgPct: number;
  dbpm: number;
  eraPaceFactor: number; // See §7 — normalizes volume stats to modern pace
}

export interface Player {
  id: string;
  name: string;
  franchise: string;
  decade: EraDecade;
  primaryPosition: Position;
  eligiblePositions: Position[];
  stats: PlayerStats;
  overallRating: number; // Composite rating for draft UI sorting (higher = better)
  peakYears: number[]; // The actual 1-3 seasons used for the peak stat line
  isCuratedDefense?: boolean; // True for pre-1974 players with manually assigned DBPM/BLK/STL
}

export interface Coach {
  id: string;
  name: string;
  systemName: string; // e.g., "Seven Seconds or Less", "Triangle", "Bad Boys"
  description?: string; // Design intent summary for UI tooltips
  modifiers: {
    stat: 'threePtPct' | 'fgPct' | 'dbpm' | 'pace' | 'usgCap';
    delta: number; // Positive = buff, negative = debuff
  }[];
}

export interface TeamLineup {
  PG: Player | null;
  SG: Player | null;
  SF: Player | null;
  PF: Player | null;
  C: Player | null;
  SIXTH: Player | null;
  coach: Coach | null;
}

export interface SynergySnapshot {
  usgTeam: number;
  phiUsg: number;
  spacingRating: number;
  spacingTier: 'ELITE' | 'GOOD' | 'AVERAGE' | 'POOR';
  spacingModifier: number;
  drtgTeam: number;
  ortgTeam: number;
  effectiveOrtg: number;
  netRating: number;
  sixthManFRF: number;
  depthBonus: number;
}

export interface SimulationResult {
  wins: number;
  losses: number;
  pointDifferential: number;
  longestStreak: number;
  isUndefeated: boolean;
  postseasonEntry: 'MISSED' | 'PLAY_IN' | 'FOURTH_SEED' | 'SECOND_SEED' | 'FIRST_SEED';
  playoffResult: {
    round: string;
    wins: number;
    losses: number;
    champion: boolean;
  } | null;
  gameLog: Array<{
    gameNumber: number;
    opponent: string;
    opponentTier: 'CONTENDER' | 'PLAYOFF' | 'AVERAGE' | 'LOTTERY';
    isBackToBack: boolean;
    isHome: boolean;
    userScore: number;
    oppScore: number;
    won: boolean;
    narrativeEvent?: string; // e.g., "One-point finish", "Overtime thriller"; must agree with stored evidence
  }>;
  lossAutopsy: string[]; // Evidence-based model disadvantages; at most three explanations
}

```

---

## 9. UI/UX Flow & Screen Wireframes

### Screen 1: The Draft Hub

```
┌─────────────────────────────────────────────────────────────┐
│  [COACH: Mike D'Antoni (+3PT / -DEF)]      REROLLS: [T:1] [D:1] │
├─────────────────────────────────────────────────────────────┤
│   SLOT REEL: [  GOLDEN STATE WARRIORS  ] × [   2010s   ]    │
│                        [ SPIN / DRAFT ]                     │
├─────────────────────────────────────────────────────────────┤
│  AVAILABLE PICKS:                                           │
│  [ Steph Curry (PG) ]  [ Klay Thompson (SG) ]  [ Draymond (PF) ]
├─────────────────────────────────────────────────────────────┤
│  CURRENT ROSTER:                                            │
│  PG: [Steph Curry '16]   SG: [Empty]        SF: [Empty]     │
│  PF: [Empty]             C:  [Empty]        6TH: [Empty]    │
├─────────────────────────────────────────────────────────────┤
│  SYNERGY METERS:                                            │
│  Usage: [||||||||||        ] 62% (Target: ≤ 135%)          │
│  DRTG: 102.0 | Base: 110 | Rim: -4.0 | Perimeter: -3.0     │
│  Team Support: -2.0 | Liability: +1.0 | Spacing: Elite     │
└─────────────────────────────────────────────────────────────┘

```

### Screen 2: The Season Ticker ("Watch the Streak")

* **Visual Presentation:** A continuous rapid timeline showing 82 nodes.
* **Color states:** Green (Win), Red (Loss), Gold (OT Win). True buzzer-beaters are deferred under §3.3 until supported by stored final-shot evidence.
* **Speed Controls:** Pause, 1x, 5x, Instant Skip.
* **Tension Spike:** From Game 50 onward while undefeated, highlight the perfect-season chase; when sound is enabled, a double-bounce pulse replaces the usual result cue every eight completed games.

### Screen 3: The Loss Autopsy & Ring Ceremony

Show the first-loss card without ending the regular season; finish all 82 games. At season completion, advance all qualifying runs under §4, not only 82-0 teams. Award the ring after 16 main-bracket wins and recognize 98-0 separately.

**Postseason presentation (implemented 2026-09-16):**

* Each series opens with a court-backed historical opponent preview, its actual net-rating benchmark and round multiplier, the roster's strongest positive modifier and largest significant disadvantage, opening win probability, home schedule and seed bonus. Rivalry evidence appears when present. The opponent dataset does not support invented shooting profiles, player box scores or tactical tendencies.
* Start Series (or Start Play-In) reveals the opening game. Next Game advances one saved reveal, changing to Next overtime period during overtime. Play runs at 1x/5x, pauses before every elimination or clinching game (including Game 7), and stops at each series boundary, including entry to the Finals. Continuing requires a deliberate action. Finish Series reveals only the current series; full-run skip remains available.
* Regular reveals take 1,400 ms at 1x; tied-overtime reveals take 2,200 ms. Hidden tabs do not advance. Reload restores the cursor and starts paused; audio preferences persist, but audio requires a browser gesture and never replays old reveals. Stakes, 16-win progress, perfect-run pursuit, sweeps, 1-3 comebacks and overtime escapes use revealed results only; playback never resamples or changes saved results.
* The active series leads the bracket. Other rounds and game details are collapsible. Finals use gold accents; the ring presentation includes the drafted roster, coach and defeated squads. Elimination summaries distinguish play-in, earlier rounds and Finals, retain the closest game, and show evidence-based final-matchup disadvantages rather than claiming a causal explanation.
* Audio is enabled by default at a fixed 100% volume, controlled globally in the header with mute only (updated 2026-09-17). Saved mute preferences are respected; legacy volume values are ignored. Fourteen original synthesized cues combine basketball-like bounces, sneaker squeaks, net swishes, whistles, buzzers and arena-style celebrations with reel ticks and lock impacts. Cues cover mode changes, coach signing, reels and rerolls, pick locks, season/series starts, playback starts/stops (including checkpoint pauses), revealed wins/losses, overtime, advancement, elimination, championships and perfect runs. Sounds are presentation accents, not claims of simulated shots or plays.
* A shared Web Audio context uses a fixed unity master gain and compressor, replacing cues within three channels (action, playback, result) so 5x/skip never queues an entire game log. Mute, leaving a results view, starting a new run and hidden tabs cancel scheduled cues. Preference storage (`98-0-audio-v1`) is independent of run saves; no gameplay random stream is used. Audio failures leave the game playable with a status message. Reduced-motion preferences disable animation independently of sound. Existing saves need no schema or simulation-version change. Interactive coaching adjustments remain outside this presentation upgrade; meaningful choices would require staged simulation and a separately versioned rules/save design.

**Defense feedback:** Show total DRTG first, with expandable numeric contributions labeled rim protection, perimeter defense, team support, and defensive-liability penalty. Show each actual signed effect on DRTG relative to the 110 baseline so the breakdown adds up. Lower total DRTG is better. Use plain-language descriptions rather than letter grades or new grade thresholds. Rename the displayed `team_depth` defensive term to team support to distinguish it from the sixth-man depth bonus; do not change its formula.

**Loss autopsy:** Display pre-game win probability, final score, and the recorded rating context. Offer at most three relevant explanations drawn from usage/spacing modifiers, fatigue, bench support, defensive contributions, and opponent advantage. These are model disadvantages, not proven causes of a particular loss. A favored team with no major weakness may simply receive "You were favored, but upsets happen." Do not fabricate a weakness to fill three slots, or claim measured shooting percentages, turnovers, or player box scores that the engine does not simulate.

---

## 10. Recommended Tech Stack

| Layer | Tooling / Library | Justification |
| --- | --- | --- |
| **Framework** | Next.js (App Router) + TypeScript | Excellent SEO, fast edge rendering, easy static export. |
| **Styling & UI** | Tailwind CSS + Shadcn UI + Framer Motion | Essential for fluid slot reel spinning and animated season counters. |
| **State Management** | Zustand | Lightweight, zero-boilerplate client state for draft slots and rolls. |
| **Simulation Core** | Pure TypeScript module (runs client-side or Web Worker) | Zero server latency; calculations happen instantly without server costs. |
| **Data Source** | Static JSON bundled at build time | No expensive live DB calls; NBA historical data doesn't change retroactively. |
| **Card Generation** | `@vercel/og` or `html-to-image` | Generates instant, visually compelling social brag images for Twitter/Instagram. |

---

## 11. Milestone Implementation Roadmap

### Pre-Phase-3 Audit (2026-09-14)

At the start of Phase 3, the game was a **playable Classic draft plus a per-game probability engine**, not yet a playable season. The table below preserves that pre-implementation audit; its implementation and gap columns are historical, not the current backlog. The regular-season runtime is now implemented as described under Phase 3 and in [the baseline report](../research/phase3/PHASE3_BASELINE.md). The earlier day estimates are retired; re-estimate remaining work once its open rules are settled.

| Spec Area | Implementation at Pre-Phase-3 Audit | Gap at That Audit |
| ----------- | ------------------------ | --------------- |
| Player and coach data (§3.1, §6–7) | 4,411 player records, 180 franchise/decade combinations, 12 coaches; curated-defense fields and pace factors are present; all 2,397 shorter peaks are retained with explicit season-count labels in the draft table and pick details | Nonconsecutive peaks and Mid IQ v1 balance approved with documented target exceptions; player/coach data unchanged |
| Opponents (§4–5) | 32 regular-season benchmarks in the specified 6/10/10/6 tiers; playoff data already grouped by round | Data is not wired into a game loop; implement §4's no-repeat opponent paths and adopted home/rest rules |
| Math engine (§3, §7) | `calculateSynergy` and `evaluateGame` compute offense, defense, spacing, usage, coach effects, bench quality, fatigue, and win probability | Apply §3.4's adopted positive-only bench DBPM correction; no sampled winner, score, overtime, schedule, or season aggregation; balance targets are not yet measured |
| Classic draft (now specified as Mid IQ; §2, §3.1, §9) | Three coach offers, six legal picks, independent rerolls, duplicate protection, bench in any round, playable-roll filtering, search and position filters | Core draft is complete; No IQ, Low IQ, HI IQ, and Daily rules are absent |
| Draft feedback (§9) | Court lineup, live chemistry, expanded stat table, plain-language Stats guide | Implement §9's numeric signed defensive contributions and evidence-based autopsy; letter grades are not part of the adopted design |
| Run state (§2, §8) | Zustand saves only the draft; phases are `COACH`, `DRAFT`, `COMPLETE` | No whole-run lifecycle, seed/version metadata, season/playoff saves, or recovery/migration validation |
| Season and post-mortem (§2, §8–9) | Completion screen explicitly says simulation is unavailable | No ticker, game log, event system, streak tracking, result screen, or loss autopsy |
| Postseason (§4, §9) | Benchmark data only; navigation is locked | No qualification, play-in, series, bracket, ring ceremony, or 98-0 result |
| Modes and retention (§4, §6) | Classic label and new-run reset only | Four IQ modes with Mid IQ as default, mode-aware chemistry/visibility, Daily challenge, Coach Almanac unlocks, sharing, and leaderboards |
| Stack and verification (§10) | Next.js, React, Zustand, plain CSS, local fonts, Lucide; math/draft unit suites and prior manual browser checks | No checked-in browser suite or online ranking service. Tailwind, Shadcn, Framer Motion, and image-export tooling are recommendations, not installed requirements |

Implementation evidence: [math engine](../../src/engine/math.ts), [draft rules](../../src/engine/draft.ts), [runtime types](../../src/engine/types.ts), [draft store](../../src/lib/draft-store.ts), [draft UI](../../src/components/draft-room.tsx), [opponent data](../../data/processed/opponents.json), and [package scripts](../../package.json). `SimulationResult` in §8 remains a proposed interface; it is not implemented in the runtime types.

### Completed Foundation

**Phase 1: Dataset & Per-Game Math — Complete, Including Phase 3 Bench Correction**

- [x] Process player, coach, franchise, and opponent datasets.
- [x] Implement pace adjustment and ORTG → DRTG → Net Rating → win probability.
- [x] Implement sixth-man quality, permanent depth bonus, and B2B fatigue scaling. Reuse these functions in Phase 3; do not rebuild them.
- [x] Cover formula boundaries, coach modifiers, defensive positions, and dataset compatibility with unit tests.

**Phase 2: Classic Draft Room — Complete for the Current Draft Scope**

- [x] Implement coach selection, animated reels, position locks, rerolls, and cross-franchise/era duplicate protection.
- [x] Support an early sixth-man pick and restrict rolls to combinations containing a legal available pick.
- [x] Display searchable player stats, court lineup, live chemistry, and the Stats guide.
- [x] Persist the current draft and confirm new-run resets; cover draft rules with deterministic test runs.

### Decisions to Settle Before Dependent Work

The remaining open decisions are listed below. Resolved rules are recorded in their owning sections; adoption does not imply runtime implementation or measured balance.

**Resolved score/event decision:** §3.3's outcome-first sampling, conditional logistic margins, shared baseline, and explicit overtime records are implemented in P3.4. Buzzer-beaters remain deferred. The [first historical calibration attempt](../research/phase3/PHASE3_SCORE_CALIBRATION.md) failed 5 of 15 held-out checks and remains retained. The [second attempt](../research/phase3/PHASE3_SCORE_RETRY.md), fitted on complete 2023-24 data and frozen before evaluating complete 2024-25 data, passes all 15 unchanged checks. The user accepted it on 2026-09-14 as `season-2` / `conditional-score-3`. The later `season-3` balance release retains these score parameters; older saves keep their pinned rules. Neither the original failed candidate nor its validation was promoted.

**Resolved B2B/rivalry decision:** §3.4's 14 randomized non-overlapping pairs, second-leg fatigue, and inter-block rest are implemented in P3.3. The six reviewed §5 franchise pairs and narrative-only evidence are now implemented as `rivalry-1`, without altering gameplay or retroactively annotating old saves.

**Resolved peak-continuity decision:** §3.1 permits nonconsecutive peak seasons within the drafted franchise and rolled decade. Keep existing selections, short peaks, and actual-year labels; no data or engine version change is needed.

**Resolved Mid IQ balance decision:** V1 was accepted with measured random-play and bounded-optimization target exceptions. The subsequent [season-3 scoring-core release](../release/MID_IQ_CORE_RELEASE.md) implements the user's qualification-contention goal for complementary star-led rosters. Later user-requested revisions raised usage tolerance (`season-4`), lowered entry to 40 (`season-5`), strengthened overload penalties (`season-6`) and raised entry to 45 (`season-7`). Preserve older saves, historical targets and unresolved exceptions. These revisions are not a replacement-release balance sign-off; historical score acceptance remains separately recorded.

**Resolved calibration, feedback, postseason, Daily, and progression package:** §3.5's strategy targets were adopted for the next replacement release through the scorecard; their percentages still refer to 60+ wins. §3.2 retains whole-offense spacing, and §3.4's positive-only bench DBPM correction is implemented. §9's numeric defense breakdowns and evidence-based autopsies are implemented. §4 settles play-in/series/home/rest rules, shared Daily priorities and attempt deadlines, regular-season-only ranking with shared ties, account identity, Almanac unlock, and 50-run local history. Entry classification, postseason gameplay and local Mid IQ Daily are implemented; general progression and online services remain pending.

| Decision | Why It Matters | Resolve By |
| ---------- | ---------------- | ------------ |
| Daily IQ mode (resolved) | Mid IQ selected by the user on 2026-09-16; `daily-1` pins this mode | Phase 6 complete |
| Online service and data policy (deferred) | Revisit backend/auth, privacy, retention and operational limits only if trusted public competition is brought back into scope; not needed for sharing with friends | Phase 8 future improvement; not a current release blocker |

### Phase 3: Reproducible Regular-Season Engine & Run State

**Status:** Complete. Runtime and Mid IQ v1 balance are approved with documented target exceptions; the second historical-score candidate passed all 15 held-out gates and was accepted and promoted with v1 save compatibility on 2026-09-14. **Depends on:** Phases 1–2 and the Phase 3 decisions above. **Spec:** §2–3, §5, §8.

- [x] P3.1 Introduce a seeded random source behind the existing injectable random callbacks. Store a run ID, seed, engine/data version, and reproducible random state or event sequence. Separate draft, schedule, outcome, and cosmetic randomness so animation cannot affect results. This is the foundation for Daily, not a Daily launch.
- [x] P3.2 Add typed opponents, schedule entries, game outcomes, and season results alongside the existing runtime types. Define whole-run transitions from draft-ready to season-running and season-complete; keep draft completion distinct from game completion.
- [x] P3.3 Generate exactly 82 games from the existing pool: 15 Contender, 25 Playoff, 30 Average, 12 Lottery; randomize order and enforce 41 home/41 away. Independently shuffle §3.4's 14 two-game blocks and 54 single-game blocks, with rest between blocks, stored pair/leg and rest-spacing evidence, and fatigue only on the 14 second legs. Game 1 must never be fatigued.
- [x] P3.4 Implement §3.3's outcome-first conditional-score model using `evaluateGame`, applying home court, coach pace, depth, and fatigue exactly once. Store opponent IDs, context, probability, rating breakdown, final/regulation scores, and overtime periods for later presentation and analysis. Preserve the sampled winner throughout score/event generation; defer true buzzer-beaters.
- [x] P3.5 Aggregate wins/losses, point differential, current/longest winning streak, first loss, and undefeated status. Finish all 82 games even after the first loss. Record version-specific qualification without pretending a playoff series has run: 60 wins for `season-1` through `season-4`, 40 for `season-5`/`season-6`, and 45 for current `season-7`.
- [x] P3.6 Extend the persisted draft store into a versioned run save, with frozen lineup/coach inputs, saved results, and recovery for old or malformed saves. Refreshing, double-clicking Start, or changing playback speed must never resample results.
- [x] P3.7 Apply §3.4's `max(0, dbpm)` bench correction with regression tests for negative, zero, positive, and coach-adjusted DBPM and bounded FRF. Wire a minimal Start Season action and regular-season summary. Define reproducible legal draft strategies and measure §3.5's provisional targets, including representative balanced, overloaded, non-shooting, defensive, and bench-heavy builds. Finalize and version score/overtime parameters; keep sigma, qualification gates, and spacing values unchanged for the first measurement pass and document subsequent tuning separately.

**P3.7 progress:** Bench correction, Start Season, summary/game log, version-pinned score rules, and measurement/review are implemented. Nonconsecutive peaks and Mid IQ v1 balance are approved with documented target exceptions. The [review](../research/phase3/PHASE3_REVIEW.md) retains the stronger legal rollout evidence: 67 median wins, 90% qualification, and +6.05 expected wins over reroll-aware greedy (approximate 95% interval 4.53–7.56). The [first historical score attempt](../research/phase3/PHASE3_SCORE_CALIBRATION.md) failed 5 of 15 held-out checks and was retained without promotion. Its artifacts, v1 compatibility rules, win probabilities, and player/coach data remain unchanged by the later release.

**P3.7 acceptance and release:** The [second experiment](../research/phase3/PHASE3_SCORE_RETRY.md) uses a complete 2023-24 development season, joint regulation scale/rounding fitting, and a fresh complete 2024-25 holdout. The frozen candidate passes **15/15 unchanged checks**. The user accepted it on 2026-09-14 as `season-2` / `conditional-score-3` with exactly those numeric parameters. Existing versioned v1 drafts, interrupted seasons, completed results, and playback retain v1 behavior without resampling or relabeling. Save schema, data version and random algorithm remain unchanged; unsupported engine/score pairs are rejected. At that release, verification reproduced every retained historical statistic, all 46 engine tests passed, and the production build passed. Mean held-out margin is 12.675 versus 12.748 observed; mean combined score is 228.380 versus 227.650. This is conditional-score evidence, not a new win-probability or draft-balance calibration. The subsequent [season-3 balance release](../release/MID_IQ_CORE_RELEASE.md) is recorded separately. Documented balance exceptions and OT-estimation limitations remain for Phase 9; both exposed holdouts are unavailable as fresh evidence for future tuning.

**Completion gate:** A legal six-player draft produces a reproducible 82-game result with correct schedule counts, integer non-tied final scores, consistent wins/differential/streaks, and reload-safe results. A failed streak does not end the run. Bench and coach effects reuse the existing math.

### Phase 4: Season Ticker, Events & Evidence-Based Loss Autopsy

**Status:** Implemented, including reviewed rivalry annotations in P4.3. Playback, feedback and postseason validation are recorded in [Phase 4 progress](../progress/PHASE4_PROGRESS.md). P3.7 historical scores remain accepted with legacy save compatibility. **Depends on:** Phase 3's stable game log. **Spec:** §2, §8–9.

- [x] P4.1 Build an 82-node timeline and running scoreboard with win/loss labels as well as color; distinguish gold overtime wins from ordinary wins using stored period data. Close finishes may be labeled from the final margin; do not label them buzzer-beaters without a future stored final-shot model.
- [x] P4.2 Add pause/resume, 1x, 5x, and instant skip. Persist the reveal position independently of the simulated outcome; render the same season at every speed and on reload without revealing future scores early.
- [x] P4.3 Surface opponent details, home/away, B2B pair/leg and fatigue, and suspenseful overtime reveals. Derive and persist §5's narrative-only rivalry evidence from the reviewed franchise list, combine matches into one alert per game, and expose supporting players in details without changing results or random state. Add the 50+ undefeated tension state, opt-in audio with mute controls, and reduced-motion behavior without changing simulation randomness.
- [x] P4.4 Show the first-loss card and end-of-season report with pre-game probability, final score, and recorded context. Follow §9: at most three relevant explanations of model disadvantages, with an upset explanation when appropriate and no invented weaknesses, shooting percentages, or turnovers.
- [x] P4.5 Preserve roster/chemistry access and expose §9's expandable numeric signed rim, perimeter, team-support, and liability contributions that reconcile with total DRTG; no letter-grade thresholds. Clearly distinguish missed qualification, playoff qualification, and 82-0; until Phase 5 exists, qualified runs must not imply an implemented postseason.

**P4.3 progress:** Opponent/context details, regulation and tied-overtime stages, 50+ undefeated visual tension, opt-in muted-by-default audio, reduced-motion styling and versioned rivalry evidence are implemented. Tests cover both pair directions, sixth-man matches, multiple matches, franchise versions, reload persistence and unchanged game results.

**Completion gate:** Playback controls change only presentation, every alert agrees with the log, the first loss is inspectable without stopping the season, and autopsy explanations use recorded evidence. Keyboard, touch, reduced-motion, and small-screen use remain functional.

### Phase 5: Play-In, Playoff Series & Championship Outcome

**Status:** P5.1–P5.5 implemented. The core championship loop has engine and desktop/mobile browser validation; title-frequency, balance and human-playtest acceptance remain Phase 9 work. See [current verification](../progress/PHASE4_PROGRESS.md#current-verification). **Depends on:** Phases 3–4. **Rules adopted in:** §4. **Spec:** §2, §4, §8–9.

- [x] P5.1 Implement version-specific entry and advancement: current `season-7` runs below 45 miss; 45–64 play-in; 65–69 fourth seed; 70–74 second seed; 75–81 first seed; 82-0 first seed. Preserve older saves and apply +1/+2 seed bonuses only at home, with +2 replacing +1. Every qualified run can start postseason after revealing all 82 games.
- [x] P5.2 Draw and persist a complete no-repeat exact-squad path from the existing round groups, including play-in when required. Apply round NR multipliers 0.90/1.00/1.05/1.10/1.15 once, §4's home/away sequences and bonuses, and no postseason fatigue; retain permanent bench support and reuse the season's game-resolution model.
- [x] P5.3 Implement one sudden-death away play-in, then four best-of-seven series ending at four wins or four losses. Freeze draws/results across reloads and keep regular-season, play-in, and main-bracket records distinct; play-in wins do not count toward the ring.
- [x] P5.4 Expand the §8 result model to retain each series and game, not only a single round summary. Persist bracket progress, elimination, and championship state, and reuse ticker controls for postseason games.
- [x] P5.5 Add bracket/series views, elimination summaries, and the ring ceremony. Award the championship after 16 main-bracket wins excluding play-in; separately recognize exactly 82-0 plus 16-0 as 98-0.

**Completion gate:** Each seed boundary and home-court rule behaves as documented; series terminate correctly; qualifying teams enter the postseason despite regular-season losses; both elimination and championship have complete, resumable result flows.

### Phase 6: Three IQ Modes & Local Daily Challenge

**Status:** Complete for local scope, 2026-09-16. Mid IQ is the selected Daily launch mode. [Implementation and validation](../progress/PHASE6_PROGRESS.md). **Depends on:** Phases 3–5. **Rules adopted in:** §4. **Spec:** §2, §4.

- [x] P6.1 Add No IQ, Mid IQ (default), and HI IQ selection. Persist and lock the mode at coach signing; interpret legacy Classic saves as Mid IQ. Apply §4's approved No IQ mapping and unchanged baseline formulas in Mid IQ/HI IQ. Preserve ordinary retries and coach/draft rules; make previews, season/playoff calculations, and autopsies mode-aware. Low IQ is removed.
- [x] P6.2 Implement HI IQ's HoopIQ-style visibility: hide stats, ratings, synergy, coaching numbers/descriptions and stat-based sorting until Start Season, not draft completion. Tables, pick dialogs, tooltips, accessible labels and completion previews are guarded; names, eras, peak years and legal positions remain visible. After Start Season, team/coach feedback and inspectable player profiles reveal the protected information. Desktop/mobile tests include all six interactive picks and reloads before/after the reveal.
- [x] P6.3 Implement §4's UTC/version/mode-pinned Daily seed, shared coach offers, round/action-specific priority lists and first-legal fallbacks, independent schedule/game-resolution streams, and unchanged-axis rerolls. Enforce one local attempt per UTC day across versions and tabs, preserve active runs across midnight and retain the 24-hour post-day grace period. Label late runs unranked and reserve authoritative account/deadline enforcement for Phase 8.
- [x] P6.4 Persist Daily completion and local personal results with IQ mode metadata; never mix modes in a ranking. Present local records as local only; public ranking and tamper resistance belong to Phase 8.

**Completion gate:** Passed functional checks: all mapped chemistry effects are neutral in No IQ, individual/bench quality remains meaningful, Mid IQ retains baseline behavior, and identical inputs/draws yield identical Mid IQ/HI IQ results. HI IQ reveals protected information only at Start Season. Modes survive reload and cannot change after coach signing. Daily replay, UTC rollover, legal priorities, rerolls, completion, same-day lockout, late labels, independent records and storage failure are covered. See [dated verification](../STATUS.md). Local storage and device time are not cheat-proof; no public ranking or trusted enforcement is claimed.

### Phase 7: Coach Almanac, Run History & Share Cards

**Status:** Complete for local scope, 2026-09-17. [Implementation and validation](../progress/PHASE7_PROGRESS.md). **Depends on:** Phase 5 result contracts and Phase 6 mode metadata. **Spec:** §2, §4, §6, §9–10.

**Social focus:** Let players share completed runs with friends through result images and text using their existing messaging/social apps. No in-game friend system, accounts or public leaderboard is required for this scope.

- [x] P7.1 Unlock all 12 Coach Almanac systems after the first completed 82-game season regardless of wins. Persist the unlock separately from active saves, including when that season is complete but postseason is still pending.
- [x] P7.2 Retain the 50 most recent completed runs plus personal-best summaries, with coach, lineup, mode, regular-season record/differential/streak, and separate play-in/postseason outcomes. Avoid resetting earned progress when starting a new draft.
- [x] P7.3 Generate a shareable image and plain-text fallback from completed results. Include regular-season/playoff records, championship/perfect-run status, mode, and Daily date where applicable; do not imply local results are verified rankings.
- [x] P7.4 Provide image download, copy/share actions with browser capability fallbacks, and clear success/failure feedback. Use `html-to-image` for fixed-width PNG exports; protect readability for long player names and mobile exports.

**Completion gate:** Passed desktop/mobile functional checks: unlocks and history survive new runs, exported records match saved outcomes, and sharing still works through a text/download fallback when clipboard or native sharing is unavailable. Actual delivery to messaging apps and physical-device validation remain unverified.

### Phase 8: Trusted Daily Leaderboards (Future Improvement)

**Status:** Deferred as an optional future improvement by user decision on 2026-09-17; outside the current release scope. Social interaction remains focused on sharing with friends through Phase 7. The tasks below are retained for future consideration, not scheduled implementation or release blockers. **Depends on (if resumed):** Phase 6 deterministic replay and an agreed ranking contract. **Spec:** §4.

- [ ] P8.1 Choose the smallest necessary backend/storage and authentication provider. Use stable account IDs and changeable display names; preserve guest IQ modes/local Daily. Implement §4's adopted ranked identity, mode, attempt, and ranking contract, and define privacy/retention and operational limits before launch.
- [ ] P8.2 Validate submissions server-side by replaying the seed and legal action history with pinned datasets/rules. Enforce allowed coach choices, rerolls, positions, and unique players; do not accept a client-supplied win count as proof.
- [ ] P8.3 Commit one ranked attempt per account/date server-side before revealing coach offers; enforce challenge-day start and server receipt before the 24-hour post-day grace deadline. Support idempotent request retries/resumes, input limits, and rate limits; abandonment cannot reset an attempt. Late results remain local and unranked, and resumes retain pinned versions.
- [ ] P8.4 Rank regular-season wins, then regular-season differential, then longest regular-season winning streak, all descending, with exact ties sharing rank and no speed tiebreaker. Accept ranking submissions after 82 games independently of postseason completion; show playoff/championship badges separately. Add loading/empty/error states and a player's rank while preserving local play during service failures.

**Completion gate:** A legitimate Daily run can be validated and ranked; tampered results, wrong-mode submissions, and illegal action histories are rejected. A backend outage does not erase the local result or prevent ordinary IQ-mode play. This phase is required before claiming global competitive leaderboards, but not for a local-game release.

### Phase 9: Balance, Accessibility & Release Readiness

**Status:** Pending. **Depends on:** Phases 3–7 for the current local-game and friend-sharing release; Phase 8 is not a dependency. Revisit online release gates only if that future improvement is resumed. **Spec:** §1–10.

**Historical evidence is partial:** Earlier validation passed 103 engine tests, production build/typechecking and 46 checked-in desktop/320px Playwright checks covering mode selection/locking, full six-pick HI IQ and Daily drafts, exact Mid IQ/HI IQ browser parity, No IQ season/playoffs, postseason presentation, rivalries, audio, Daily deadlines, legacy retries, persistence and recovery. See [project status](../STATUS.md) for later checks and current rules. Wider drafting variants, accessibility/performance checks and human playtests remain open. The [release scorecard](../release/RELEASE_SCORECARD.md) retains failed or unmeasured replacement-release gates; passing functional checks are not mode-balance or full-product acceptance. Commands are documented in [the README](../../README.md).

- [ ] P9.1 Revisit the Phase 3 balance baselines with full seasons and playoffs: usage/spacing tradeoffs, era viability, all coaches, bench quality, qualification frequency, title frequency, and perfect-run rarity. Measure each IQ mode separately: No IQ should support star-studded teams, while Mid IQ and HI IQ share chemistry balance. Agree on mode-specific targets before tuning and version any changes that affect Daily replay.
- [ ] P9.2 Check data provenance and labeling, short-peak policy, missing/curated historical stats, and benchmark pool consistency. Resolve remaining conflicts in earlier spec sections rather than leaving implementation notes as the only authority.
- [ ] P9.3 Add repeatable browser coverage to complement the current engine unit suites and manual checks. Establish release gates for the full draft-to-result journey, save upgrades/recovery, modes, playback, sharing, and online submission where enabled.
- [ ] P9.4 Verify touch/keyboard access, screen-reader labels, non-color result cues, responsive tables/brackets, reduced motion, audio controls, and error recovery. Measure bundle size and simulation responsiveness; introduce a worker only if measurements justify it.
- [ ] P9.5 Document local and production commands, choose static/client deployment for the local game and friend-sharing release, and complete build/dependency/security checks and deployed smoke checks. Server-backed leaderboards and their secret configuration are deferred with Phase 8.

**Completion gate:** The enabled scope completes end to end on desktop and mobile, balance targets are documented, saves survive supported upgrades, required quality checks pass, and unavailable features are not advertised as playable.

### Dependency Order & Coverage

**Next work:** Phase 9 release readiness. Phase 7 Coach Almanac, general run history and sharing with friends are complete for local scope. Local Daily is complete in Mid IQ; Phase 8 trusted account-based competition is an optional future improvement outside this release. No IQ, Mid IQ and HI IQ span the core championship loop. Measure No IQ balance separately and playtest HI IQ's hidden-information experience. P3.7's accepted scores, historical holdouts and Mid IQ balance exceptions remain preserved. Human playtesting, title-frequency measurement and remaining Phase 9 checks are still needed.

| Spec Requirement Group | Milestones |
| ------------------------ | ------------ |
| Draft and coaching formulas (§3, §6–7) | Phases 1–2 complete; integration P3.4; balance P3.7/P9.1 |
| 82-game schedule, fatigue, scores, result types (§2–3, §5, §8) | P3.1–P3.7 |
| Ticker, suspense, events, streaks, loss autopsy (§2, §9) | P4.1–P4.5 |
| Qualification, play-in, bracket, ring, 98-0 (§2, §4, §8–9) | P5.1–P5.5 |
| No IQ, Mid IQ, HI IQ, and Daily seed fairness (§4) | P6.1–P6.4, using P3.1 |
| Coach Almanac and exportable social results (§2, §6, §9–10) | P7.1–P7.4 |
| Global Daily rankings (§4; optional future improvement) | P8.1–P8.4 deferred; outside current release |
| Balance, data fidelity, platform and release quality (§1–10) | P9.1–P9.5 |

**Release boundaries:** Phase 5 is the complete Mid IQ game (formerly Classic); Phases 6–7 add the other IQ modes, local Daily, retention and sharing with friends. This is the current release scope, subject to the relevant Phase 9 checks. Phase 8 trusted public competition is a deferred future improvement and does not block that release. Apply basic accessibility and correctness checks throughout development.

### Math Engine API

Implemented in [src/engine/math.ts](../../src/engine/math.ts), with dataset-compatible interfaces in [src/engine/types.ts](../../src/engine/types.ts).

```typescript
import { calculateSynergy, evaluateGame } from './src/engine/math.ts';
import type { TeamLineup } from './src/engine/types.ts';

function previewMatchup(lineup: TeamLineup, opponentNetRating: number) {
  const synergy = calculateSynergy(lineup);
  const game = evaluateGame(lineup, {
    opponentNetRating,
    isHome: true,
    isBackToBack: false,
  });
  return { synergy, winProbability: game.winProbability };
}
```

* Pass raw processed player stats to the lineup APIs. Inputs are never mutated. `normalizeStats` returns a copy with `eraPaceFactor: 1` to prevent repeated scaling.
* `calculateSynergy` supports incomplete draft previews: empty slots contribute zero, and positional averages retain their fixed denominators. `evaluateGame` requires five starters; the sixth man and coach may be absent. Draft eligibility and duplicate protection belong to the drafting layer.
* Coach FG% and 3P% adjustments are clamped to [0, 1]. Coach DBPM applies to starters and the bench. Bench quality now uses `max(0, coached DBPM)` with negative, zero, positive, coach-adjusted, and bounded-FRF regression coverage.
* Snapshot `netRating` excludes depth, fatigue, home court, and coach pace. `evaluateGame` adds each once, with +3 at home and zero away, and returns both the rating breakdown and win probability.
* The example above uses the low-level API's legacy defaults: `mid-iq-1` and a 115% usage base. To match an actual saved run, pass `lineupForUsagePolicy(lineup, run.engineVersion)` and `balanceForRun(run)` to the synergy/game APIs, as the draft preview and season runtime do. Qualification is applied separately by `seasonForQualification`; do not treat low-level legacy defaults as current `season-7` rules.
* The per-game math API stops at probability. [The season module](../../src/engine/season.ts) adds schedules, sampled outcomes/scores, overtime, logs, and aggregation. [The postseason module](../../src/engine/postseason.ts) reuses scoring with separate seeded paths/results, home bonuses and series records. [Playback](../../src/engine/playback.ts) derives revealed results without modifying saved outcomes. Save recovery tolerates at most `2 * Number.EPSILON` in probability comparisons for cross-runtime rounding, not in scores, ratings or other state.

Requires Node.js 22.6+ for native TypeScript execution. From the repository root, run `npm install`, then `npm test` and `npm run typecheck`. Tests cover formula boundaries, immutable normalization, defensive roles, coaching, bench effects, and compatibility with the processed datasets.

### Draft Room (Phase 2)

Run `npm run dev` and open the local URL printed by Next.js (normally `http://localhost:3000`). Run `npm run build` for the production build and `npm start` to serve it. The UI uses Next.js App Router, React, Zustand, locally bundled fonts, Lucide icons, and CSS reel animations with reduced-motion support.

* [src/engine/draft.ts](../../src/engine/draft.ts) owns immutable coach selection, rolls, rerolls, candidate sorting, and position locks. Randomness is injectable for deterministic tests.
* [src/components/draft-room.tsx](../../src/components/draft-room.tsx) provides searchable, position-filtered picks, an accessible position-selection dialog, the court lineup, and live synergy readings. All undrafted players in a roll remain visible; players without an eligible open slot cannot be selected.
* [src/lib/draft-store.ts](../../src/lib/draft-store.ts) persists the active run and pinned IQ mode in browser local storage. Reloading preserves offers, roll, picks, tokens, seeded action history, frozen season inputs, and completed results. Valid legacy drafts remain Mid IQ; malformed/unsupported saves have recovery notices and a best-effort raw backup. New runs require confirmation and default to Mid IQ.
* Rolls sample uniformly from franchise/decade combinations with at least one legal undrafted player. A team reroll preserves the decade; an era reroll preserves the franchise. Rerolls must change the selected reel and are disabled without a valid alternative, leaving the token unspent. The same combination may recur on a later pick.
* Duplicate protection uses the Basketball-Reference identity prefix in the processed player ID, not the full franchise/decade ID. The sixth man can be selected in any round.
* The sixth pick completes the draft and displays the roster and Start Season action. Ratings remain hidden in HI IQ until that action. No IQ shows individual team quality with chemistry disabled; Mid IQ retains full chemistry feedback. Phase 3 resolves all 82 games once; Phase 4 reveals saved results through a paused-by-default ticker. Qualifying runs can start Phase 5 under the same pinned mode, with saved postseason results and a separate cursor. Regular-season/playoff tabs preserve both records. Daily remains unavailable.

Validation: `npm test` covers draft rules plus the existing math suite, including 100 deterministic six-pick runs with the bench selected first. `npm run typecheck` checks both engine and UI types. Browser checks cover coach selection, both rerolls, search/filters, Escape dismissal, reload persistence, six-pick completion, reset confirmation, and desktop/mobile layouts down to 320px.
