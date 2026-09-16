# 98-0

A sports roguelike where you draft history's greatest NBA starting five, survive an 82-game gauntlet, and chase an undefeated season.

Draft six players (five starters plus a 6th man) by spinning a Team × Era slot reel, then watch an animated season ticker resolve all 82 games. Roster chemistry — usage overload, floor spacing, defensive roles, coach synergies — decides whether your superteam actually works.

Inspired by `82-0.com`, *Wordle*, *Balatro*, *BasketballGM*, and *Immaculate Grid*.

## Status

Phase 4 (season playback) is largely implemented. Playoffs are not playable yet. See [docs/PHASE4_PROGRESS.md](docs/PHASE4_PROGRESS.md) for the current state and known gaps.

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
| `npm run typecheck` | `tsc --noEmit` |
| `npm run calibrate` | Balance harness — simulates batches of drafted runs across draft strategies |

`npm run calibrate` takes optional positional args: sample size, output path, comma-separated strategies, seed prefix, and engine version. Example:

```powershell
npm run calibrate -- 500 docs/OUT.json chemistry,balanced,overloaded p3-baseline- season-3
```

## Project layout

```
src/app/          Next.js routes and global styles
src/components/   Draft room, season ticker, defense breakdown
src/engine/       Simulation: draft rules, synergy math, season/postseason, RNG, calibration
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
- [docs/BASELINE_PLAYTEST.md](docs/BASELINE_PLAYTEST.md) — baseline playtest findings

The many `MID_IQ_*.json` and `PHASE3_*.md` files are calibration experiment records produced by `npm run calibrate` and the Python audit scripts. They are evidence for balance decisions, not runtime inputs.

## Simulation notes

The engine is seeded and deterministic: a given seed, engine version, and data version always reproduce the same 82-game result. Each save pins its engine/data/score version, so existing runs keep their original balance rules when constants change — `season-1` through `season-4` rule sets all still resolve, with `season-3` current. Season playback replays a result that was already simulated and saved; it never draws new randomness.
