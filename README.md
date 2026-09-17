# 98-0

A sports roguelike where you draft history's greatest NBA starting five, survive an 82-game gauntlet, and chase an undefeated season.

Draft six players (five starters plus a 6th man) by spinning a Team × Era slot reel, then watch an animated season ticker resolve all 82 games. Roster chemistry — usage overload, floor spacing, defensive roles, coach synergies — decides whether your superteam actually works.

Inspired by `82-0.com`, *Wordle*, *Balatro*, *BasketballGM*, and *Immaculate Grid*.

## Public playtest

Play at **<https://98-0.vercel.app>**. Anyone with the link can play without an account. This is a playtest build, not balance or full release acceptance.

Saves, Daily attempts and history stay in the current browser on this domain; they do not sync between devices or transfer from localhost. Clearing site data removes them. Ask testers to use this stable URL and send their device/browser, a screenshot or shared result, and what happened versus what they expected. Physical-device sharing and Safari/Firefox remain unverified.

Published to Vercel project `preciadox/98-0` on 2026-09-17. Vercel connected the GitHub repository for automatic deployments; pushes to its configured production branch can update the playtest. No gameplay secrets, database or environment variables are required. For a manual update from this folder after validation:

```powershell
npx --yes vercel@latest deploy --prod
```

Keep the production alias stable so browser saves remain available. Record the deployment URL when collecting observations; the earlier season-3 playtest protocol is not evidence for this build.

Verification on 2026-09-17: 114 engine tests, typecheck, production build and 94 local desktop/320px Edge browser checks passed. The public URL returned HTTP 200 without authentication. Eight deployed desktop/mobile checks passed for six-pick drafting and playback, Daily completion/reload/practice, postseason history and PNG exports, and share fallbacks. The checked runtime dependencies had no known CVEs; this was not a comprehensive security audit or human playtest.

Audio simplification deployed on 2026-09-17: removed volume settings and the test-sound popover; enabled audio now uses fixed 100% master gain with the existing compressor. Mute still persists, legacy volume values are ignored, and run saves are unchanged. Immutable deployment: <https://98-0-ayk9d5flv-preciadox.vercel.app>; public alias remains <https://98-0.vercel.app>.

Validation: `npm test` passed 114 tests; `npm run typecheck`, `npm run build`, and `git diff --check` passed. `PLAYWRIGHT_CHANNEL=msedge npm run test:browser -- tests/browser/audio.spec.ts` passed 12 local desktop/320px checks, with screenshots reviewed. Verified project settings with `npx --yes vercel@latest project inspect 98-0 --scope preciadox`, then published using `npx --yes vercel@latest deploy --prod --yes --scope preciadox`. Public access returned HTTP 200 without credentials. With `PLAYWRIGHT_BASE_URL=https://98-0.vercel.app`, the audio, postseason, Daily and collection browser files filtered by `sound|audio|legacy volume|six-pick draft|Daily commits before offers|history updates pending postseason|clipboard and native-share|copy and native share` passed all 22 checks (exit code 0). An earlier live run was interrupted; this complete run supersedes it. The remote URL override was cleared afterward. Full browser-suite rerun, subjective listening, physical devices, Safari/Firefox and actual messaging-app delivery remain unverified for this narrow update.

To repeat those deployed checks (the optional URL disables the local test server):

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
$env:PLAYWRIGHT_BASE_URL = 'https://98-0.vercel.app'
npm run test:browser -- tests/browser/postseason.spec.ts tests/browser/daily.spec.ts tests/browser/collection.spec.ts --grep 'six-pick draft|Daily commits before offers|history updates pending postseason|clipboard and native-share'
Remove-Item Env:PLAYWRIGHT_BASE_URL
```

## Status

As of 2026-09-17, the local game is playable through drafting, the seeded 82-game season, play-in, four playoff series and championship/perfect-run results. Playback includes rivalries, overtime, loss explanations, defense breakdowns and audio enabled by default at 100%, with a persistent mute toggle.

- **IQ modes:** choose before signing a coach. No IQ disables chemistry and coach effects while retaining individual offense, defense and bench quality. Mid IQ is the default. HI IQ uses the same simulation as Mid IQ but hides scouting information until Start Season.
- **Postseason:** new runs qualify at 45 wins after all 82 games are revealed. Start Postseason explicitly; a ring requires 16 main-bracket wins. A perfect 98-0 requires 82-0 plus 16-0, without a play-in.
- **Local Daily:** Mid IQ challenges rotate indefinitely through 56 themes, reshuffled each cycle from September 17, 2026 UTC. Attempts and results are local/unverified; retries are practice. Requires browser storage, Web Locks and HTTPS or localhost. See [Daily rules and limits](docs/progress/PHASE6_PROGRESS.md).
- **Collection and sharing:** completing an 82-game simulation unlocks all 12 Coach Almanac systems. History retains 50 recent seasons and per-mode personal bests. Revealed results support PNG/text export and browser sharing. See [storage, spoiler rules and fallbacks](docs/progress/PHASE7_PROGRESS.md).

Online rankings (Phase 8) are deferred. Phase 9 release gates, human playtesting, mode-specific balance acceptance and physical-device verification remain open. Local clocks and storage are not trusted; installation is supported, but there is no offline cold-launch cache.

### Haptic feedback

Short vibration patterns accompany draft actions, playback and result reveals on devices with a supported Vibration API. The vibration icon beside sound toggles haptics independently of mute. Its preference is stored under `98-0-haptics-v1`, separate from run saves. Haptics default on unless reduced motion is requested; an explicit saved choice takes precedence. Feedback requires interaction, stops when the page is hidden, and never replays just because a save loads.

The control is hidden when the API is missing, including Safari on iPhone/iPad. Browsers, device hardware and OS settings may suppress vibration even when the API exists; installing the web app does not add native haptic support. Unavailable or rejected vibration never blocks gameplay.

Local verification on 2026-09-17: `npm run typecheck` and `npm run build` passed (exit code 0). `PLAYWRIGHT_CHANNEL=msedge npm run test:browser -- tests/browser/audio.spec.ts` passed all 20 desktop/320px checks (exit code 0), including eight new haptic checks for patterns, independent mute, persistence, reduced-motion defaults, storage failures, background cancellation, saved results and unsupported APIs. Desktop/mobile screenshots were reviewed. Vibration API calls are mocked; physical-device feel and delivery remain unverified. This change has not been deployed.

### Installable app

The game remains playable in a browser. Supporting browsers can also install it as **98-0**, opening in a standalone window from the home screen or app launcher. The header shows an Install control when Chrome/Edge supplies a native install offer; browser eligibility, engagement, prior dismissal, private browsing and device policy determine availability. Safari on iPhone/iPad shows an Install control with Share > Add to Home Screen guidance. Controls are hidden in standalone mode.

Installation adds no account, backend, service worker or offline cache. Opening the app requires internet access. The root URL and save formats are unchanged; existing storage is not migrated or cleared. Storage remains browser/origin-specific, and home-screen storage sharing varies by platform. Do not promise cross-device sync or that an iOS installation inherits Safari saves.

Local verification on 2026-09-17: `npm run typecheck` and `npm run build` passed. `npm run test:browser -- tests/browser/install.spec.ts` with Edge passed 14 desktop/320px checks (exit code 0), covering manifest and PNG dimensions, prompt acceptance/dismissal/error, installed state, Safari guidance, continued drafting and saved-run reload. Chromium reported no installability errors in disposable regular profiles; default Playwright incognito contexts correctly rejected installation. Desktop/mobile screenshots were reviewed. Native prompt lifecycle and Safari detection use mocks; actual OS installation, launch from a home-screen icon, Android/iOS devices and Safari remain unverified.

Published on 2026-09-17 from clean commit `8811e8c8f9e33fa081b1de16285a29ad2ecb6fcc` using `npx --yes vercel@latest deploy --prod --yes --scope preciadox`, after confirming the existing project with `npx --yes vercel@latest project inspect 98-0 --scope preciadox`. Immutable deployment: <https://98-0-rlv7kyqh8-preciadox.vercel.app>; stable alias: <https://98-0.vercel.app>. No accounts, storage migration or offline cache were added.

Pre-publish checks passed: `npm test` (115 tests), `npm run typecheck`, `npm run build`, `git diff --check`, and 24 local Edge desktop/320px browser checks. The public alias returned HTTP 200 without credentials, with the game title and manifest present. The same 24 browser checks passed against the public alias (exit code 0), using `npm run test:browser -- tests/browser/install.spec.ts tests/browser/postseason.spec.ts tests/browser/daily.spec.ts tests/browser/collection.spec.ts --grep 'install|standalone|Safari|six-pick draft|Daily commits before offers|history updates pending postseason|clipboard and native-share|copy and native share'`. `PLAYWRIGHT_CHANNEL=msedge` was used throughout; `PLAYWRIGHT_BASE_URL=https://98-0.vercel.app` was set only for deployed checks and cleared afterward. Deployed desktop/mobile screenshots were reviewed. Full browser-suite rerun, physical-device installation, Safari/Firefox, actual messaging-app delivery and human balance acceptance remain separate work.

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
