# Mid IQ Roster Benchmark Review

Date: 2026-09-14. Status: **expectations approved, conditional player-record checks pending; no new benchmark performance measured**.

This is the September 14 expectation-freeze snapshot. On September 15 the user authorized autonomous evaluation; record checks, development measurements and the rejected candidate are documented in [Roster-First Calibration](MID_IQ_ROSTER_CALIBRATION.md). The catalog remains frozen for source-hash reproducibility. The review-time status above does not describe the subsequent evaluation state.

## Purpose

A recognizable, well-constructed team should perform like a contender. Different basketball identities should have viable paths to success, and weaknesses should matter without erasing the value of great players.

This is the reviewed set: **24 base rosters, eight variants, all 12 coaches**. The [machine-readable catalog](../data/reference/mid-iq-roster-benchmarks.json), revision `mid-iq-roster-review-2`, contains exact player IDs, approved targets, strengths, weaknesses and the 13 chat decisions. Player and coach source fingerprints are unchanged. Nothing in the live season-3 balance has changed.

All 32 lineups pass player identity, coach existence and position-eligibility checks. That does **not** establish a legal acquisition history or how frequently the necessary rolls and coach offers occur. These are team-value benchmarks; ordinary-draft accessibility remains a separate measurement.

The reference C01 already has exposed results from the [previous balance release](MID_IQ_CORE_RELEASE.md). It is development evidence only. The other entries have not been evaluated as this benchmark suite. Reserved families are prospective validation cases for the next tuning experiment, not proof of independence from every earlier design decision or from shared player data.

## Approved Targets

| Tier | Expected Regular-Season Wins | Intended Experience |
| --- | ---: | --- |
| Qualification contender | 59-63 | A credible chance of 60 wins; not automatic qualification |
| Strong contender | 64-68 | Usually qualifies, with room for disappointing seasons |
| Exceptional | 69-74 | Outstanding construction; no promise of perfection |
| Below .500, support-only | 35-44 | Defense has value but does not replace offensive leadership |
| Below .500, late-career | 30-40 | Provisional until the stored career versions are checked |

These are **expected-win bands**, not requirements that every seeded result land inside the band. Qualification probability, realized-win distributions and uncertainty must be reported separately. Universal qualification-probability bands are not approved. Do not silently reuse C01's earlier 55-75% probability target for every roster. Shared bands do not require identical results or an exact ranking.

The original 45-54 band now has no assigned roster and has been removed from the catalog. Gaps and overlaps between bands are not engine rules; these benchmarks are not an exhaustive classification of all possible teams.

| Approved Band | Roster IDs | Count |
| --- | --- | ---: |
| 59-63 | C01, F02, F03 | 3 |
| 64-68 | C02-C12, F01 | 12 |
| 69-74 | E01-E06, F06 | 7 |
| 35-44 | F05 | 1 |
| 30-40, provisional | F04 | 1 |

There are now **15 contenders, seven exceptional teams and two below-.500 teams**. IDs retain their original prefixes for traceability; the catalog's `group` and `tier` fields define current classifications. No roster, player version, coach or family reservation was changed by the review.

## Read the Lineups

Players are listed in **PG / SG / SF / PF / C / sixth-man order**. A suffix such as `NYK20` means the New York franchise's **2020s record**, not a single 2020 season. `LAL00` means the Lakers' 2000s record. These records aggregate their stored peak years; the rosters are not historical single-season reconstructions.

`OKC90` represents Seattle-era players under the dataset's Oklahoma City franchise lineage. Manu means Manu Ginobili; Jokic means Nikola Jokic. Every short name below resolves to the exact player ID in the catalog. **R** means reserved validation family; all other rows are development cases. The entire family, including future variants, follows that reservation.

## Original C-Series Contenders

| ID | Team Idea | Players in Slot Order | Coach | Approved Tier |
| --- | --- | --- | --- | --- |
| C01 | Your Brunson-Towns-Duncan team | Brunson NYK20 / P.J. Tucker TOR10 / Dillon Brooks MEM10 / Duncan SAS00 / Towns NYK20 / LaSalle Thompson IND90 | Popovich | Qualification |
| C02 | Shaq and Kobe with support | Derek Fisher LAL00 / Kobe LAL00 / Bruce Bowen SAS00 / Robert Horry LAL00 / Shaq LAL00 / LaSalle Thompson IND90 | Phil Jackson | Strong |
| C03 | Jordan with specialists | Terry Porter POR90 / Jordan CHI90 / Shane Battier HOU00 / Rodman CHI90 / Brook Lopez MIL20 / Horford ATL10 | Larry Brown | Strong |
| C04 R | Detroit collective defense | Billups DET00 / Richard Hamilton DET00 / Tayshaun Prince DET00 / Rasheed Wallace DET00 / Ben Wallace DET00 / Clifford Robinson DET00 | Chuck Daly | Strong |
| C05 | Nash and Dirk spacing | Nash PHX00 / Ray Allen MIL00 / Shane Battier HOU00 / Dirk DAL00 / Horford ATL10 / Derek Fisher LAL00 | Don Nelson | Strong |
| C06 | Paul and Garnett two-way fit | Chris Paul LAC10 / Klay GSW10 / Shane Battier HOU00 / Garnett MIN00 / Horford ATL10 / Iguodala GSW10 | Jerry Sloan | Strong |
| C07 | LeBron with shooting and support | Derrick White BOS20 / Klay GSW10 / LeBron MIA10 / Robert Horry LAL00 / Horford BOS20 / Iguodala GSW10 | Spoelstra | Strong |
| C08 R | Curry motion and rim support | Curry GSW10 / Klay GSW10 / Iguodala GSW10 / Draymond GSW10 / Brook Lopez MIL20 / Derrick White BOS20 | Steve Kerr | Strong |
| C09 R | Magic and Kareem with one shooter | Magic LAL80 / Reggie Miller IND90 / Jerome Kersey POR90 / Buck Williams POR90 / Kareem LAL80 / Terry Porter SAS00 | Red Auerbach | Strong |
| C10 | Payton and Kemp with Ewing | Gary Payton OKC90 / Ray Allen OKC00 / Detlef Schrempf OKC90 / Shawn Kemp OKC90 / Ewing NYK90 / Clifford Robinson POR90 | Pat Riley | Strong |
| C11 R | Jokic passing hub | Jamal Murray DEN20 / Caldwell-Pope DEN20 / Tayshaun Prince DET00 / Aaron Gordon DEN20 / Jokic DEN20 / Horford BOS20 | Rick Adelman | Strong |
| C12 R | Boston wing depth | Derrick White BOS20 / Jrue Holiday BOS20 / Jaylen Brown BOS20 / Tatum BOS20 / Horford BOS20 / Brook Lopez MIL20 | Spoelstra | Strong |

### Why These Should Work

- **C01:** Three complementary scorers, Duncan's interior defense and usable shooting. Early Memphis Brooks and a modest reserve are genuine limitations.
- **C02:** Two dominant scorers with recognizable support roles. It should not need a third superstar just to contend, but the bench is modest.
- **C03:** One elite scoring lead supported by playmaking, defense and a stretch center. The test is whether Jordan can carry the scoring role without five independent scorers.
- **C04:** Collective defense with an established lead guard and compatible roles. Its championship identity is useful context, not a demand to reproduce a historical win total.
- **C05:** Shooting and orchestration around Dirk, with less defensive dominance. This should succeed differently from the defensive teams.
- **C06:** A lead guard and two-way big with off-ball shooting. It tests fit rather than simply accumulating individual scoring averages.
- **C07:** LeBron organizes the offense while others shoot, defend and make secondary decisions. The absence of a dominant interior scorer should remain a weakness.
- **C08:** Curry's off-ball offense with passing and defensive support. It should not require Durant to become a contender.
- **C09:** Traditional passing and interior greatness with a dedicated shooter. This is a direct test of whether modern shooting volume is too dominant.
- **C10:** Strong two-way players with two interior threats. Frontcourt overlap should cost something without automatically invalidating the roster.
- **C11:** A passing center, perimeter partner and complementary wings. It tests a different offensive organization from a guard-led team.
- **C12:** A balanced modern rotation without a single all-time offensive hub. This checks whether the new top-three weighting undervalues broad depth.

C04, C08, C11 and C12 lean on repeated franchise identities. They are useful basketball-value cases but must not be described as common draft outcomes without an accessibility study.

## Original E-Series Exceptional Teams

All six are approved at **69-74 expected wins**, joined by F06 below. These are ceiling references, not the standard users must meet to qualify.

| ID | Team Idea | Players in Slot Order | Coach |
| --- | --- | --- | --- |
| E01 R | Durant motion superteam | Curry GSW10 / Klay GSW10 / Durant GSW10 / Draymond GSW10 / Brook Lopez MIL20 / Manu SAS00 | Steve Kerr |
| E02 | All-time inside-out balance | Chris Paul LAC10 / Kobe LAL00 / Pippen CHI90 / Garnett MIN00 / Shaq LAL00 / Manu SAS00 | Phil Jackson |
| E03 | Jordan-Bird with twin anchors | Stockton UTA90 / Jordan CHI90 / Bird BOS80 / Duncan SAS00 / David Robinson SAS90 / Ray Allen MIL00 | Popovich |
| E04 | Shooting around Hakeem | Nash PHX00 / Reggie Miller IND90 / Durant OKC10 / Dirk DAL00 / Hakeem HOU90 / Iguodala GSW10 | D'Antoni |
| E05 | Magic's two-big all-time team | Magic LAL80 / Klay GSW10 / Pippen CHI90 / Duncan SAS00 / Kareem MIL70 / Manu SAS00 | Pat Riley |
| E06 R | LeBron-Jokic shared creation | Chris Paul LAC10 / Ray Allen MIL00 / LeBron MIA10 / Garnett MIN00 / Jokic DEN20 / Jrue Holiday MIL20 | Spoelstra |

- **E01:** Elite creation and shooting with defensive support; usage sharing and reserve value still matter.
- **E02:** Exceptional talent in complementary roles. Its many high-usage stars make it an important test of the strength of the overload penalty.
- **E03:** Passing, perimeter creation and elite interior defense. Historical shooting volume and two-big overlap should not erase its strengths.
- **E04:** Hakeem anchors a shooting-heavy offense. Perimeter defense remains a meaningful tradeoff.
- **E05:** Traditional passing and two interior stars with a dedicated shooter. The user approved exceptional status before performance measurement.
- **E06:** Multiple elite decision-makers rather than a single ball handler. Tests whether the model can value shared creation without treating every creator as redundant.

The user placed E02/E06 one tier above F01: role overlap and uneven defense can cost the latter something, but historical usage totals must not erase its extraordinary talent.

## Reclassified F-Series Teams

These were originally proposed as flawed cases at 45-54 wins. The chat review rejected that blanket classification: four are now contenders or exceptional, and two have lower targets. The F-prefix remains only as a stable identifier.

| ID | Team Idea | Players in Slot Order | Coach | Approved Expected Wins |
| --- | --- | --- | --- | --- |
| F01 | Every scorer wants the ball | Westbrook OKC10 / Harden HOU10 / Carmelo NYK10 / Barkley PHX90 / Shaq LAL00 / Iverson PHI00 | Don Nelson | 64-68 |
| F02 | Offense without defensive coverage | Nash PHX00 / Iverson PHI00 / Carmelo DEN00 / Dirk DAL00 / Towns MIN10 / Harden OKC10 | D'Antoni | 59-63 |
| F03 | Defense with no shooting outlet | Kidd BKN00 / Wade MIA00 / Rodman CHI90 / Draymond GSW10 / Ben Wallace DET00 / LaSalle Thompson IND90 | Larry Brown | 59-63 |
| F04 | Familiar names, wrong career versions | Nash LAL10 / Wade CHI10 / Carmelo LAL20 / Garnett BKN10 / Shaq CLE10 / Derek Fisher UTA00 | Phil Jackson | 30-40, provisional |
| F05 R | All support, no scoring lead | Derek Fisher LAL00 / Bruce Bowen SAS00 / Tayshaun Prince DET00 / Buck Williams POR90 / Ben Wallace DET00 / LaSalle Thompson IND90 | Chuck Daly | 35-44 |
| F06 R | Historical greatness, crowded frontcourt | Magic LAL80 / Jordan CHI90 / Rodman CHI90 / Bill Russell BOS60 / Wilt PHI60 / Kareem MIL70 | Red Auerbach | 69-74 |

- **F01:** Stars should adapt enough to contend comfortably. Overlap and uneven defense keep it below the exceptional tier rather than making it weak.
- **F02:** Elite offense partly compensates for limited defensive coverage. Qualification should be less reliable than for a balanced strong contender.
- **F03:** Wade's scoring, Kidd's creation and substantial defense keep it in contention despite cramped offensive spacing.
- **F04:** Reputation must not rescue diminished selected versions. Confirm that the stored records support the provisional 30-40 target without consulting simulated performance.
- **F05:** Defense and rebounding have value, but low usage and support roles cannot replace a credible offensive leader.
- **F06:** Extraordinary selected-version talent outweighs spacing and positional overlap on this roster. Better fit can still help; it is not a prerequisite for exceptional results.

## Eight Controlled Variants

These inherit their parent's family reservation. The following comparison rules were approved in chat. Conditional record checks remain outstanding; no numerical effect size was invented for every substitution. Real player substitutions change several statistics at once; they are not pure coefficient experiments.

| ID | Parent | Change | Approved Relationship |
| --- | --- | --- | --- |
| V01 | C01 | Brooks MEM10 to Brooks HOU20 at SF | Review the actual records first; do not assume the later version is better in every respect |
| V02 | C02 | Bowen SAS00 to Rodman CHI90 at SF | Shooting versus defense/rebounding; no automatic required direction |
| V03 | C03 | Jordan CHI90 to Tucker TOR10 at SG | Meaningfully weaker; lower usage must not erase the loss of a lead scorer |
| V04 | C01 | LaSalle Thompson IND90 to Horford ATL10 at sixth man | Provisional 2-4 expected-win gain if records confirm a clear reserve upgrade |
| V05 | C06 | Popovich instead of Sloan | Contextual coach tradeoff, not proof of a universal ranking |
| V06 | C01 | Towns at PF, Duncan at C | Identical under the current shared PF/C defensive-role model |
| V07 | E02 | Kobe LAL00 to Kobe LAL90 at SG | Weaker if records confirm the talent gap; lower usage alone should not turn that loss into an upgrade |
| V08 | C05 | Fisher LAL00 to Manu SAS00 at sixth man | Improvement if records confirm a clear upgrade, while accounting for fit |

### Coach and Reserve Influence

- **Coach fit:** Roughly **2-4 expected wins** between a well-suited and poorly suited coach for the same roster. Similar fits can be much closer. No universal best coach, and no claim that the particular V05 pair must differ by 2-4 wins.
- **Sixth man:** Roughly **2-4 additional expected wins** for a clear reserve upgrade, provisionally. V04 requires a stored-record check before it becomes a firm numeric example. Higher historical usage must not automatically make a better reserve harmful.
- These are contextual design expectations, not fixed bonuses, independently additive effects or guarantees about one realized season.

There are no fractional-stat perturbations in this first set. Later, use small synthetic perturbations separately to test continuity at spacing boundaries, keeping them distinct from plausible human-picked teams.

## Next Evaluation Stage

This review does not authorize running simulations or tuning. When evaluation is requested:

1. Resolve F04's provisional target and the conditional V01/V04/V07/V08 record checks using stored player data, not benchmark outcomes. The 13 decisions are recorded below and in the catalog; do not reopen approved bands just to match the existing model.
2. Freeze the development/validation family assignments. There are **15 development and 9 validation base rosters**; shared individual players across families are unavoidable, so do not claim a fully player-independent holdout.
3. Evaluate the approved development rosters under explicit season-3 rules first. Low-level engine APIs retain legacy defaults; the evaluator must select the correct balance and score rules.
4. Report expected wins, qualification probabilities, realized distributions, and schedule/outcome uncertainty separately. Do not count 82 games as 82 independent roster observations or tune to one seed's actual record.
5. Change one mechanism at a time and evaluate all development cases, including the variants. Do not fit only the average error while sacrificing an entire roster identity.
6. Freeze a candidate and acceptance criteria before evaluating reserved families. Once exposed, those families are no longer fresh evidence for a revised candidate; reserve new families or disclose reuse.
7. Keep the existing legal-draft policies and human playtests as separate accessibility checks. The exceptional reference teams must not become a hidden minimum roster quality for qualification.

No player-specific, coach-specific or seed-specific win overrides. Historical team reputation is a design reference, not a claim that these mixed-peak rosters should reproduce real NBA records against our historical opponent pool. Playoff and title-frequency validation remains separate.

## Chat Decision Log

| Decision | User Choice | Recorded Outcome |
| --- | --- | --- |
| 1 | A | F06 moves from 45-54 to exceptional, 69-74 |
| 2 | C | F04 moves from 45-54 to provisional 30-40, pending stored-version review |
| 3 | B | F05 moves from 45-54 to 35-44 |
| 4 | B | F01 moves from 45-54 to strong contender, 64-68 |
| 5 | B | C03 moves from 59-63 to strong contender, 64-68 |
| 6 | A | C04 retains strong contender, 64-68 |
| 7 | B | F03 moves from 45-54 to qualification contender, 59-63 |
| 8 | B | F02 moves from 45-54 to qualification contender, 59-63 |
| 9 | Retain these bands | C01 retains 59-63; C02/C05-C12 retain 64-68 with listed coaches and reserves |
| 10 | A | E01-E06 retain exceptional, 69-74 |
| 11 | B | Contextual coach-fit contrast roughly 2-4 expected wins |
| 12 | B | Clear reserve upgrade roughly 2-4 expected wins, provisional |
| 13 | A | Remaining comparison rules approved, with conditional record checks |

The roster identities and family reservations are unchanged: 15 development and nine validation cases. All 12 coaches remain represented, but this is not balanced per-coach sampling. Numerical gates for qualitative comparisons and universal qualification-probability bands remain unspecified; do not silently create them as approved requirements.

Validation so far: all 24 rosters and eight variants are legal under current lineup rules; player/coach fingerprints match; the seven existing draft tests including the new catalog check pass. No benchmark ratings, predicted wins or qualification results have been generated in this step.
