# 98-0

A sports roguelike where you draft history's greatest NBA starting five, survive an 82-game gauntlet, and chase an undefeated season.

Draft six players (five starters plus a 6th man) by spinning a Team × Era slot reel, then watch an animated season ticker resolve all 82 games. Roster chemistry — usage overload, floor spacing, defensive roles, coach synergies — decides whether your superteam actually works.

Inspired by `82-0.com`, *Wordle*, *Balatro*, *BasketballGM*, and *Immaculate Grid*.

## Status

As of 2026-09-17, the local game is playable through drafting, the seeded 82-game season, play-in, four playoff series and championship/perfect-run results. Playback includes rivalries, overtime, loss explanations, defense breakdowns and opt-in audio.

- **IQ modes:** choose before signing a coach. No IQ disables chemistry and coach effects while retaining individual offense, defense and bench quality. Mid IQ is the default. HI IQ uses the same simulation as Mid IQ but hides scouting information until Start Season.
- **Postseason:** new runs qualify at 45 wins after all 82 games are revealed. Start Postseason explicitly; a ring requires 16 main-bracket wins. A perfect 98-0 requires 82-0 plus 16-0, without a play-in.
- **Local Daily:** Mid IQ challenges rotate indefinitely through 56 themes, reshuffled each cycle from September 17, 2026 UTC. Attempts and results are local/unverified; retries are practice. Requires browser storage, Web Locks and HTTPS or localhost. See [Daily rules and limits](docs/progress/PHASE6_PROGRESS.md).
- **Collection and sharing:** completing an 82-game simulation unlocks all 12 Coach Almanac systems. History retains 50 recent seasons and per-mode personal bests. Revealed results support PNG/text export and browser sharing. See [storage, spoiler rules and fallbacks](docs/progress/PHASE7_PROGRESS.md).

Online rankings (Phase 8) are deferred. Phase 9 release gates, human playtesting, mode-specific balance acceptance and physical-device verification remain open. Local clocks and storage are not trusted; there is no offline installation or cold-launch cache.

The latest recorded full validation is in [Phase 7](docs/progress/PHASE7_PROGRESS.md#validation): 112 engine tests, 92 desktop/mobile Edge checks, typecheck and production build passed. These are dated functional results, not human-playtest or balance sign-off. See [the release scorecard](docs/release/RELEASE_SCORECARD.md) for acceptance gates.

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
npm run calibrate -- 500 docs/research/mid-iq/OUT.json chemistry,balanced,overloaded p3-baseline- season-3
```

## Project layout

```
src/app/          Next.js routes and global styles
src/components/   Draft room, season ticker, defense breakdown
src/engine/       Draft rules, synergy math, season, postseason, rivalries, RNG, calibration
src/lib/          Run/progress/Daily persistence and audio
data/raw/         Basketball-Reference CSVs (downloaded)
data/processed/   players.json, coaches.json, opponents.json, franchises.json
data/reference/   Real NBA score distributions used as calibration targets
scripts/data_pipeline/  Python fetch/process/audit/validate scripts
tests/browser/    Playwright desktop/mobile regression journeys
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

See the [documentation index](docs/README.md) for the folder guide and complete reading list.

| Document | Role |
|---|---|
| [docs/design/GAME_DESIGN.md](docs/design/GAME_DESIGN.md) | Current rules and roadmap; dated decisions remain historical |
| [docs/progress/PHASE7_PROGRESS.md](docs/progress/PHASE7_PROGRESS.md) | Latest full functional validation; collection and sharing contract |
| [docs/progress/PHASE6_PROGRESS.md](docs/progress/PHASE6_PROGRESS.md) | Current Daily rotation, compatibility and focused validation |
| [docs/release/RELEASE_SCORECARD.md](docs/release/RELEASE_SCORECARD.md) | Binding acceptance gates and outstanding measurements |
| [docs/release/MID_IQ_CORE_RELEASE.md](docs/release/MID_IQ_CORE_RELEASE.md) | Historical season-3 balance release, not current-build sign-off |
| [docs/research/mid-iq/MID_IQ_ROSTER_CALIBRATION.md](docs/research/mid-iq/MID_IQ_ROSTER_CALIBRATION.md) | Research history and stopped experiments |
| [docs/playtests/BASELINE_PLAYTEST.md](docs/playtests/BASELINE_PLAYTEST.md) | Historical season-3 protocol; no human sessions recorded; needs a new build registration before use |

`MID_IQ_*.json`, `PHASE3_*` reports and earlier phase reviews preserve calibration evidence, not current gameplay status. They now live under `docs/research`, with frozen JSON contents unchanged. Tests and offline tools resolve their historical metadata through the [documented migration](docs/README.md#research-compatibility). Preserve this evidence, including superseded or failed results; raw/reference data and research scripts support its reproducibility.

Generated build/test output, Python bytecode and the local `.venv` are ignored. Do not commit them or delete active server output as part of documentation cleanup.

## Simulation notes

The engine is seeded and deterministic: identical draft actions and pinned seed, engine, data and random/score versions reproduce the same run. Different lineups can produce different results from shared game draws. Season playback replays a result that was already simulated and saved; it never draws new randomness.

New runs use **`season-7` / `mid-iq-3` / `conditional-score-3`**: a 135% base usage cap plus coach adjustments, 1.5% offensive efficiency lost per usage point above the cap (0.45 floor), and qualification at 45 wins after all 82 games. Higher entry tiers remain 65/70/75 wins. Postseason starts explicitly after regular-season playback completes and preserves the regular-season record.

Rivalry evidence and postseason rules are versioned separately. Old saves without rivalry metadata stay unannotated, but qualifying saved seasons can enter the postseason. Playback cursors are separate for regular season and postseason. Recovery permits at most two machine epsilons of cross-runtime rounding in win probabilities while preserving saved values; ratings, scores, winners and other state remain exact.

New saves also pin `iqMode` and `iqVersion: iq-1`. Saves without those fields retain Mid IQ behavior and their original results. The mode-aware wrapper preserves the frozen baseline math source; No IQ uses its separate `no-iq-1` policy for previews, games and recovery. Local hidden information is a play mode, not protection against inspecting downloaded datasets or browser storage.

Supported saves retain their pinned rules and results: `season-1` through `season-4` require 60 wins; `season-5` and `season-6` require 40; `season-7` requires 45. The 135% cap began in `season-4`, and the stricter overload penalty began in `season-6`. Older saves are not resampled or relabeled. Frozen calibration reports retain their original versions and qualification thresholds.
