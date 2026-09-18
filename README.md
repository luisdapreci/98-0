# 98-0

A basketball drafting roguelike. Build a team from NBA history, play through an 82-game season, and chase a perfect playoff run: **82 regular-season wins + 16 playoff wins = 98-0**.

## Public playtest

**Play now: <https://98-0.vercel.app>**

Free to access in your browser, with no account required. The game is in public playtesting; balance and device compatibility are still being evaluated. See [project status](docs/STATUS.md) for updates and known limitations.

### Player guide deployment, 2026-09-17

- Published the first-visit guide and header help button to <https://98-0.vercel.app>; immutable deployment: <https://98-0-f0rhqqkrf-preciadox.vercel.app>. Gameplay rules, supported saves and saved results are unchanged; dismissal uses the separate `98-0-guide-v1` preference.
- Passed `npm test` (115 tests), `npm run typecheck`, `npm run build` and `git diff --check`. All 128 Edge browser checks passed across desktop and 320px mobile: `npm run test:browser -- tests/browser/daily.spec.ts --project=desktop` and `--project=mobile` (20 each), then the other eight browser spec files with each project (44 each). An earlier combined run was interrupted by terminal reuse and is not counted as passing evidence.
- Confirmed the existing project using `npx --yes vercel@latest project inspect 98-0 --scope preciadox`, then published with `npx --yes vercel@latest deploy --prod --yes --scope preciadox`. Anonymous `Invoke-WebRequest` returned HTTP 200 with game and guide content.
- With `PLAYWRIGHT_CHANNEL=msedge` and `PLAYWRIGHT_BASE_URL=https://98-0.vercel.app`, ran `npm run test:browser -- tests/browser/guide.spec.ts tests/browser/postseason.spec.ts tests/browser/daily.spec.ts tests/browser/collection.spec.ts --grep 'first visit guide|Escape dismisses|guide remains|returning player header|six-pick draft|Daily commits before offers|history updates pending postseason|clipboard and native-share|copy and native share'`: 18 passed, exit code 0. The remote override was cleared afterward.
- Reviewed desktop/mobile screenshots; verified dismissal, reopening, keyboard focus, blocked guide storage, header fit and saved-draft preservation. Physical devices, Safari/Firefox, real messaging-app delivery and comprehensive accessibility acceptance remain unverified. Source changes are not committed or pushed.

## How to play

The first visit opens a player guide. Reopen it anytime with the **How to play** question-mark button beside the sound and vibration controls. Closing it remembers dismissal in this browser/site, separately from run saves. If browser storage is blocked, the guide remains dismissible but may appear again after reloading.

1. **Choose your IQ mode and sign a coach.** Decide how much chemistry and scouting information you want to manage.
2. **Draft six players.** Spin the Team x Era reels to find historical players, then build five starters and a sixth man. Use team and era rerolls to shape your options.
3. **Start the season.** Watch an animated ticker reveal all 82 games, including rivalries, overtime, defensive breakdowns and explanations for losses.
4. **Chase a championship.** New runs qualify for the postseason at 45 wins. After the regular season is fully revealed, start the postseason and navigate the play-in where applicable, then four playoff series. A ring takes 16 main-bracket wins; a perfect 98-0 also requires an 82-0 regular season and no play-in.

## What makes a team work

The biggest names do not automatically make the best lineup. In chemistry-enabled modes, your roster must balance:

- **Usage:** too many ball-dominant scorers can overload the offense.
- **Spacing:** shooting gives the lineup room to operate.
- **Defensive roles:** individual defense and complementary roles both matter.
- **Coach fit:** each system rewards a different kind of roster.
- **Bench quality:** your sixth man contributes to the team's strength.

The simulation is seeded and repeatable. The same draft actions, seed and rule versions reproduce the same run. Playback reveals an already-saved result; reloading does not reroll games. Supported older saves keep their original rules and results.

## IQ modes

Choose a mode before signing your coach:

| Mode | Experience |
| --- | --- |
| **No IQ** | Focus on individual offense, defense and bench quality. Chemistry and coach effects are disabled. |
| **Mid IQ** | The default: build around chemistry, roles and coach synergies with scouting information available. |
| **HI IQ** | The same simulation as Mid IQ, but scouting information stays hidden until you start the season. |

## Daily, collection and sharing

- **Daily challenges:** a Mid IQ challenge each UTC day, rotating through 56 themes reshuffled each cycle. Your first attempt counts locally; retries are practice. Results are not server-verified, and there are no online rankings.
- **Coach Almanac:** complete an 82-game simulation to unlock all 12 coach systems for reference.
- **Season history:** keep your 50 most recent seasons and personal bests for each IQ mode.
- **Shareable results:** export revealed results as text or a square PNG, or share through a supported browser.

## Browser experience

Play on desktop or mobile, with sound effects and a persistent mute toggle. Supported devices also offer independently controlled vibration for drafting, playback and results. Vibration availability depends on the browser, hardware and OS; it is not supported in Safari on iPhone/iPad.

Supporting browsers can install **98-0** to the home screen or app launcher. Chrome/Edge can offer native installation; iPhone/iPad Safari uses Share > Add to Home Screen. **Internet access is required to open the game:** installation does not add offline support.

Saves, Daily attempts, preferences and history stay in the current browser and site. They do not sync across devices or transfer from localhost or preview URLs. Clearing site data removes them, and an installed app may use separate storage on some platforms. Daily requires browser storage and Web Locks over HTTPS or localhost.

Inspired by `82-0.com`, *Wordle*, *Balatro*, *BasketballGM*, and *Immaculate Grid*.

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

The app serves at <http://localhost:3000>. Processed game data is committed under `data/processed/`, so no pipeline run is needed to play.

## Scripts

| Command | Purpose |
| --- | --- |
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

```text
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

## Documentation

See the [documentation index](docs/README.md) for the complete reading list, research archive and data compatibility notes.

| Document | Role |
| --- | --- |
| [docs/STATUS.md](docs/STATUS.md) | Current project status, dated updates, deployment evidence and remaining work |
| [docs/design/GAME_DESIGN.md](docs/design/GAME_DESIGN.md) | Current rules and roadmap; dated decisions remain historical |
| [docs/progress/PHASE7_PROGRESS.md](docs/progress/PHASE7_PROGRESS.md) | Collection and sharing contract; phase-specific validation |
| [docs/progress/PHASE6_PROGRESS.md](docs/progress/PHASE6_PROGRESS.md) | Current Daily rotation, compatibility and focused validation |
| [docs/release/RELEASE_SCORECARD.md](docs/release/RELEASE_SCORECARD.md) | Binding acceptance gates and outstanding measurements |
