# 98-0

A sports roguelike where you draft history's greatest NBA starting five, survive an 82-game gauntlet, and chase an undefeated season.

Draft six players (five starters plus a 6th man) by spinning a Team × Era slot reel, then watch an animated season ticker resolve all 82 games. Roster chemistry — usage overload, floor spacing, defensive roles, coach synergies — decides whether your superteam actually works.

Inspired by `82-0.com`, *Wordle*, *Balatro*, *BasketballGM*, and *Immaculate Grid*.

## Status

As of 2026-09-16, the core loop is playable in **No IQ**, **Mid IQ** (default), and **HI IQ**: drafting, the reproducible 82-game season, rivalry annotations, play-in, four playoff series and championship/perfect-run results. Playback includes overtime reveals, loss explanations, defense breakdowns and opt-in audio. Postseason adds matchup previews, elimination/clincher pauses, series-by-series skipping, championship progress, highlights and personalized endings.

Select the IQ mode before signing a coach; it stays locked for the run. **No IQ** disables usage, spacing, coach effects and defensive-role fit while retaining individual offense, defense and bench quality. **Mid IQ** preserves the former Classic rules. **HI IQ** uses identical Mid IQ simulation but hides scouting stats, coaching effects, chemistry and stat-based sorting until **Start Season**, including after the sixth pick. Low IQ has been removed. **Local Daily is implemented in Mid IQ**; Coach Almanac, general run history, sharing and online rankings remain unimplemented.

Open Daily from the header calendar button. Each UTC date pins a shared challenge, coach offers and round/action-specific reel priorities, with first-legal fallbacks. The first local attempt is committed before offers; abandoning it does not restore it, and retries are unranked practice. Active Daily drafts resume across midnight. Local results received before the end of the following UTC day retain first-attempt status; later finishes are marked late/unranked. Regular-season records persist separately from active runs, with mode, date, wins, differential and longest streak. These are local, unverified records, not a public leaderboard. Daily requires working browser storage and Web Locks on HTTPS or localhost; ordinary runs remain available without Web Locks. Clearing storage or changing the device clock bypasses local controls. See [docs/PHASE6_PROGRESS.md](docs/PHASE6_PROGRESS.md).

The first themed calendar contains **28 unique challenges, September 16 through October 13, 2026**, with fixed coaches, era windows, franchise pools and locked-player starts. New `daily-2` runs pin the calendar and theme; older Daily saves retain their original rules. The Daily dialog includes the dated calendar. It does not loop or repeat themes under new seeds: after October 13, new Daily entry waits for another published calendar, while unfinished runs remain playable.

New runs require **45 wins** to qualify; after revealing all 82 games, choose **Start Postseason**. A ring requires 16 main-bracket wins; 98-0 requires exactly 82-0 plus 16-0, without a play-in.

Changing IQ mode before coach signing starts a fresh seeded draft with reshuffled coach offers, excluding the immediately previous coaches when enough alternatives exist. Clicking the active mode or reloading preserves the offers.

Sound is opt-in from the header speaker control, with volume and a preview in Sound settings. Original synthesized basketball-inspired effects cover reel spins/stops, coach signing, pick locks, playback starts/stops, wins/losses, overtime, series advancement and championship/perfect-run endings. Mute and volume persist separately from the run. Reload never replays old cues; a browser gesture unlocks audio. Hidden tabs cancel sounds, and fast playback replaces earlier cues instead of building a queue. Audio never changes simulation results.

See [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) for current rules and planned work, [docs/PHASE6_PROGRESS.md](docs/PHASE6_PROGRESS.md) for current validation, and [docs/RELEASE_SCORECARD.md](docs/RELEASE_SCORECARD.md) for outstanding release gates. Current checks: 107 engine tests, 56 desktop/320px browser tests using Edge (including 10 audio and 18 Daily checks), and production build pass. Audio checks exercise real waveform rendering/cancellation, settings persistence, zero volume, background muting, draft/playback events, unsupported browsers and unchanged saves. These are functional checks, not listening, mode-specific balance or human-playtest acceptance; no completed human playtest is recorded.

## Stack

- **Next.js 16** / **React 19** app router, TypeScript
- **Zustand** for run state and save persistence
- A deterministic, seeded simulation engine in [src/engine](src/engine) with no framework dependencies
- A **Python** data pipeline that compiles Basketball-Reference CSVs into the game's player/coach/opponent datasets

Requires **Node >= 22.6** (the engine tests and calibration harness run TypeScript directly via `--experimental-strip-types`).

## Getting started

```powershell
npm install
npm run dev
```

The app serves at http://localhost:3000. Processed game data is committed under `data/processed/`, so no pipeline run is needed to play.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm test` | Engine regression suite (`src/engine/*.test.ts`) |
| `npm run test:browser` | Playwright desktop/mobile journeys against a production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run calibrate` | Balance harness — simulates batches of drafted runs across draft strategies |

Browser tests require `npm run build` first and a Playwright browser (`npx playwright install chromium`), or an installed Edge browser with `$env:PLAYWRIGHT_CHANNEL = 'msedge'`. The suite starts and stops its own server on port 4180; set `PLAYWRIGHT_PORT` to another unused port if necessary.

`npm run calibrate` takes optional positional args: sample size, output path, comma-separated strategies, seed prefix, and engine version. Example:

```powershell
npm run calibrate -- 500 docs/OUT.json chemistry,balanced,overloaded p3-baseline- season-3
```

## Project layout

```
src/app/          Next.js routes and global styles
src/components/   Draft room, season ticker, defense breakdown
src/engine/       Draft rules, synergy math, season, postseason, rivalries, RNG, calibration
src/lib/          Zustand draft store
data/raw/         Basketball-Reference CSVs (downloaded)
data/processed/   players.json, coaches.json, opponents.json, franchises.json
data/reference/   Real NBA score distributions used as calibration targets
scripts/data_pipeline/  Python fetch/process/audit/validate scripts
docs/             Design spec, calibration studies, phase reviews
```

## Data pipeline

Raw CSVs come from [sumitrodatta/bball-reference-datasets](https://github.com/sumitrodatta/bball-reference-datasets). To rebuild the processed datasets:

```powershell
pip install -r scripts/data_pipeline/requirements-analysis.txt
python scripts/data_pipeline/run_pipeline.py
```

The pipeline fetches raw data (cached), builds peak-season player lines, generates historical opponent teams and coaches, then validates schema and basketball consistency. Downloads are skipped if the raw files already exist.

## Design and balance docs

- [docs/GAME_DESIGN.md](docs/GAME_DESIGN.md) — the core spec: game loop, synergy formulas, IQ modes, draft rules
- [docs/MID_IQ_CORE_RELEASE.md](docs/MID_IQ_CORE_RELEASE.md) — Mid IQ release notes
- [docs/RELEASE_SCORECARD.md](docs/RELEASE_SCORECARD.md) — acceptance scorecard
- [docs/BASELINE_PLAYTEST.md](docs/BASELINE_PLAYTEST.md) — baseline playtest protocol; participant results pending

The many `MID_IQ_*.json` and `PHASE3_*.md` files are calibration experiment records produced by `npm run calibrate` and the Python audit scripts. They are evidence for balance decisions, not runtime inputs.

## Simulation notes

The engine is seeded and deterministic: identical draft actions and pinned seed, engine, data and random/score versions reproduce the same run. Different lineups can produce different results from shared game draws. Season playback replays a result that was already simulated and saved; it never draws new randomness.

New runs use **`season-7` / `mid-iq-3` / `conditional-score-3`**: a 135% base usage cap plus coach adjustments, 1.5% offensive efficiency lost per usage point above the cap (0.45 floor), and qualification at 45 wins after all 82 games. Higher entry tiers remain 65/70/75 wins. Postseason starts explicitly after regular-season playback completes and preserves the regular-season record.

Rivalry evidence and postseason rules are versioned separately. Old saves without rivalry metadata stay unannotated, but qualifying saved seasons can enter the postseason. Playback cursors are separate for regular season and postseason. Recovery permits at most two machine epsilons of cross-runtime rounding in win probabilities while preserving saved values; ratings, scores, winners and other state remain exact.

New saves also pin `iqMode` and `iqVersion: iq-1`. Saves without those fields retain Mid IQ behavior and their original results. The mode-aware wrapper preserves the frozen baseline math source; No IQ uses its separate `no-iq-1` policy for previews, games and recovery. Local hidden information is a play mode, not protection against inspecting downloaded datasets or browser storage.

Supported saves retain their pinned rules and results: `season-1` through `season-4` require 60 wins; `season-5` and `season-6` require 40; `season-7` requires 45. The 135% cap began in `season-4`, and the stricter overload penalty began in `season-6`. Older saves are not resampled or relabeled. Frozen calibration reports retain their original versions and qualification thresholds.
