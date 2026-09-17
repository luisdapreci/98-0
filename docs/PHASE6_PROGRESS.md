# Phase 6: Local Daily Completion

Date: 2026-09-16. P6.1-P6.4 are complete for local gameplay. The user selected **Mid IQ** as the Daily launch mode. Public ranking, authenticated attempts and trusted deadlines remain Phase 8.

## Implemented Contract

- New `daily-2` seeds pin UTC date, Mid IQ, IQ/engine/data/random/score/rivalry versions plus `calendar-1` and challenge ID. Existing `daily-1` saves and ledger results retain their original unrestricted pools, three offers and seeds. Ordinary runs, baseline math and calibration artifacts are unchanged.
- The [published calendar](../src/engine/daily-calendar.ts) runs from **2026-09-16 through 2026-10-13 inclusive**: 28 distinct coach, era, franchise or fixed-player restrictions from the approved no-repeat draft. It does not use modulo rotation or repeat a theme with a new seed. Outside the published dates, new Daily starts are disabled without spending an attempt; unfinished runs still resume. Future dates require a newly published set of unique themes, preserving this version for replay.
- Fixed-coach days offer only the named coach, still requiring signing. Other days retain three seeded offers. Era/franchise restrictions apply to priorities, spins, rerolls, candidates and pick validation. Fixed-player days place the exact franchise/era record in its specified slot before coach signing, leaving five manual picks and excluding all other versions of that person. The locked slot cannot be replaced. The next roll uses the existing occupied-slot round number.
- Sorted canonical franchise/decade sets from the restricted pool are shuffled in independent round/action/axis streams. The first legal franchise, then first legal decade within it, wins. Team/era rerolls retain the opposite axis, must change the requested axis and keep the token when no alternative exists. Single-era days retain their unused era token, with the control disabled. Earlier picks can require different legal fallbacks.
- Daily rolls never advance the sequential draft random state. Schedule and outcome/score streams remain independently seeded by the challenge, not attempt IDs or actions. Unique attempt IDs distinguish local/practice saves without changing their challenge draws.
- `RunSave.daily` retains date, version, first-local/practice kind, start time and attempt ID; `daily-2` also requires calendar version and challenge ID. Recovery reconstructs initial restrictions and locked players, replays the legal action history and rejects inconsistent challenge/date/mode/version/seed metadata. Mode changes cannot modify Daily runs.
- `98-0-daily-v1` stores commitments and regular-season summaries separately from the active run. Web Locks serialize starts and result writes. Commitment precedes revealing offers; corrupt/full/unavailable storage blocks new Daily entry without clearing records or replacing the active run.
- One first-local attempt per date is tracked in this browser profile. Abandoning retains the commitment; retries are practice. An active unfinished Daily resumes with its original date across midnight. New dates never automatically replace active runs.
- Regular-season completion is recorded independently of postseason and playback. The strict receipt deadline is UTC midnight two days after the challenge date; equality is late. Practice/late records are unranked. Results list date, Mid IQ, wins/losses, differential and longest winning streak, with local-only labels. The active record does not reveal totals before all 82 playback results are visible.
- The ranking comparator refuses different challenges/modes and uses wins, differential, then longest streak descending. Exact ties ignore completion time. The UI is a chronological personal record list, not a public ranking.
- The Daily dialog shows the current theme, restriction and expandable 28-day dated calendar. Draft/result banners and local records retain the theme. Reel animation, coach pool counts and reroll availability reflect the restricted pool. An open dialog refreshes its UTC date; a date change during start requires reopening instead of silently accepting an unseen challenge.

## Draftability Guarantee

Every challenge is checked against the bundled data before starting. After excluding the fixed player's identity and occupied slot, each remaining slot must have at least as many distinct eligible identities as there are remaining slots. This sufficient condition is intentionally conservative: after any legal pick, at most one eligible identity disappears from each slot and the required slot count decreases by one. Therefore every legal sequence retains enough distinct candidates to complete the roster; first-legal roll fallback can always offer one. All 28 pools pass. This is a legality guarantee, not a guarantee of good roster quality or favorable results.

## Verification

Existing Node and Playwright suites were reused; no backend, database or Docker infrastructure is required for this local-only scope. Browser tests use installed Edge against a production Next.js server on port 4192, at 1440x1000 and 320x800.

| Check | Result | Exit Code |
| --- | --- | --- |
| `npm run typecheck` | Pass | 0 |
| `npm run build` | Pass; static application generated | 0 |
| `npm test` | 107 passed, 0 failed, 0 skipped | 0 |
| `npm run test:browser -- tests/browser/daily.spec.ts` | 18 passed, 0 failed | 0 |
| `npm run test:browser` | 56 passed, 0 failed | 0 |

New [engine tests](../src/engine/daily.test.ts) cover UTC date validation, strict grace boundaries, action/round priority independence, dataset-order independence, legal six-pick replay including an early sixth man, both reroll axes, unavailable rerolls, schedule independence, locked mode, save metadata rejection and comparison ties.

New [browser tests](../tests/browser/daily.spec.ts) cover commitment before offers, interactive six-pick completion, reloads, retained summaries, identical practice offers, UTC rollover/resume, abandonment, next-day entry, late completion and corrupt/full-storage failure. Existing IQ-mode, audio, postseason, rivalry and save-recovery checks remain green. Desktop/mobile Daily screenshots were inspected; document overflow checks pass. Initial browser failures were corrected by awaiting the asynchronous start transition and narrowing an alert selector; no failing checks were waived.

The unique-calendar extension adds distinct restriction signatures, exact fixed-player references, conservative completion coverage, no-wrap date boundaries, all 28 themes with two complete draft/season replay paths each, legal rerolls, locked slots, duplicate protection, metadata rejection and legacy compatibility. Browser journeys add fixed-coach presentation, single-era and two-franchise pools, five-pick fixed-center/fixed-bench drafts, all 28 calendar entries and expiry with last-day resume. Production startup, engine and browser tiers all passed with exit code 0. No infrastructure tier applies; Node 24.14.0 and Edge/Playwright were available. Screenshots cover fixed-coach, restricted draft and expired-calendar layouts. These checks do not establish difficulty balance or server trust.

## Limits

- Local storage, device clocks and downloaded seeds are user-controlled. No trusted accounts, server receipt, tamper resistance, cross-device recovery or public leaderboard is implemented. Clearing browser data removes commitments/results. Web Locks require HTTPS or localhost and browser support.
- There is still one active run save. Starting another run discards its draft/playback, but not Daily commitments or recorded summaries. General 50-run history, postseason summary archives, Almanac unlocks and sharing belong to Phase 7.
- Functional validation is not Daily difficulty calibration, mode-balance acceptance, a human playtest, a complete accessibility audit or Safari/physical-mobile verification.