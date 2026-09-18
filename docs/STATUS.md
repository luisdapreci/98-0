# Project status and updates

For the game overview and local setup, see the [README](../README.md). This document holds current status, dated development updates and deployment evidence. Add future updates here, with scope, validation and remaining limitations; keep the README focused on the game.

## Current status

As of **2026-09-17**, the public playtest is available at **<https://98-0.vercel.app>**, without authentication. Drafting, all three IQ modes, the 82-game season, play-in, four playoff series, championship results, Daily challenges, collection, sharing, audio, haptics, install support and the first-visit player guide are implemented.

The latest deployment is the Daily single-attempt, description-sharing and compact mobile-stat update from commit `8299c50`: <https://98-0-pjlqryoy9-preciadox.vercel.app>. New validation passed 115 engine tests, typecheck, production build, whitespace checks, 44 local and 44 deployed desktop/mobile Edge browser checks, plus anonymous HTTP 200 with game content. These are dated functional results, not human-playtest, balance or full release acceptance.

The player table has a narrower, frozen desktop name column, and the result popup previews the exact square share PNG. Deployed: mobile player stats use one compact ten-column row beneath the name; desktop and HI IQ layouts are unchanged by this follow-up.

Deployed: Daily now allows one attempt per UTC day in the current browser, including cancelled or abandoned attempts. Same-day restarts are blocked across versions and tabs; unfinished saves remain resumable. All visible practice labels are removed from Daily, history and sharing, while legacy saved data remains readable. The next Daily unlocks at 00:00 UTC.

Deployed: Daily share images and text now include the challenge name and restriction description. New summaries preserve the run's version-correct details; older summaries recover them from a matching Daily record when available. Ordinary exports are unchanged.

Deployed: the Daily popup uses START DAILY for all starts, removes the redundant bottom dismiss button, and replaces RESUME DAILY with CANCEL DAILY to abandon the active Daily draft and create a normal run. The top X only dismisses the popup; Daily commitments and records remain.

Deployed: background music loops with a three-second crossfade, starts after interaction, and shares the existing mute control. Music pauses when muted or hidden and resumes without restarting. The user confirmed public-use rights/permission for the recording. The original FLAC is preserved locally and excluded from CLI uploads; its public URL returns 404.

### Remaining work and limitations

- Online rankings (Phase 8) are deferred. Daily attempts use local clocks and storage and are not trusted or server-verified.
- Phase 9 release gates, human playtesting and mode-specific balance acceptance remain open. See the [release scorecard](release/RELEASE_SCORECARD.md).
- Physical-device vibration, native installation, Safari/Firefox and actual messaging-app delivery remain unverified, except for the limited Android user feedback recorded below. Mocked APIs do not prove physical-device behavior.
- Installation has no service worker or offline cold-launch cache. Opening the game requires internet access.
- Saves, Daily attempts and history are browser/origin-specific. They do not sync across devices; clearing site data removes them. Home-screen storage sharing varies by platform, so iOS installations are not guaranteed to inherit Safari saves.
- Runtime dependency checks are not a comprehensive security audit. Accessibility and full release acceptance remain separate work.

For playtest feedback, use the stable public URL and collect the device/browser, a screenshot or shared result, and actual versus expected behavior. Record the deployment URL with observations. The [baseline playtest protocol](playtests/BASELINE_PLAYTEST.md) is historical season-3 material, with no human sessions recorded; register a current build before using it.

## Deployment contract

Vercel project: `preciadox/98-0`. Git integration is enabled; pushes to the configured production branch can publish updates. Verify that branch rather than assuming its name. No gameplay secrets, database or runtime environment variables are required.

Follow [AGENTS.md](../AGENTS.md#vercel-playtest-deployment) for authorization, exact-source checks, project-link verification, deployment and live validation. Do not publish merely because documentation changed. Keep the production alias stable to preserve browser storage access, and use it in shared results and tester invitations, not immutable deployment URLs.

All named deployments below retained <https://98-0.vercel.app>. The recorded project verification and publication commands were:

```powershell
npx --yes vercel@latest project inspect 98-0 --scope preciadox
npx --yes vercel@latest deploy --prod --yes --scope preciadox
```

Browser results below used Edge (`PLAYWRIGHT_CHANNEL=msedge`) on desktop and mobile/320px profiles. Deployed runs set `PLAYWRIGHT_BASE_URL=https://98-0.vercel.app`, disabling the local test server, and cleared it afterward. Commands were run from the repository root. The passing runs do not establish physical-device or native sharing acceptance.

## Update history

Entries are newest first. All updates below were recorded on **2026-09-17**. Validation counts apply only to their stated source and scope.

### Daily and compact mobile-stat deployment, 2026-09-17

- Published source commit `8299c50` to <https://98-0.vercel.app>; immutable deployment: <https://98-0-pjlqryoy9-preciadox.vercel.app>. Initial Git status was clean. Scope: one Daily attempt per UTC day, removed player-facing retry-kind labels, version-correct Daily descriptions in shared images/text and compact mobile player stats. No application code was changed during publication; no commit or push was performed.
- Verified `npx --yes vercel@latest project inspect 98-0 --scope preciadox` after successful browser authentication: existing project ID `prj_syeOx1sQASaIcYcADSoizyvqJuOd`, repository root, Next.js preset, Node 24.x and default build/output. Restored the missing local link with `npx --yes vercel@latest link --project 98-0 --scope preciadox --yes`; verified organization `team_LwuzAXXOcnvWtnRgwwGRzzhL`. The CLI-created `.env.local` remains ignored and excluded from uploads; no credentials were printed or committed.
- Initial `npm test` failed 11 of 115 tests because Windows checkout CRLF bytes did not match frozen research checksums. Verified that LF conversion exactly restored recorded hashes for three raw CSVs, three reference score JSONs and three data-pipeline Python files, then applied only those formatting changes. Preserved generated JSON files that correctly matched CRLF; no values, frozen expectations or gameplay logic changed. All nine formatting-only files are excluded from Vercel uploads. `git diff --ignore-space-at-eol --stat` showed no semantic differences; Git may flag these local formatting changes.
- Required pre-publication checks then passed: `npm test` (115), `npm run typecheck`, `npm run build`, `git diff --check`, and 44 local Edge desktop/320px browser checks against the fresh production build, with remote/reuse overrides cleared. Used `npm run test:browser -- tests/browser/postseason.spec.ts tests/browser/daily.spec.ts tests/browser/collection.spec.ts tests/browser/guide.spec.ts tests/browser/modes.spec.ts --grep 'six-pick draft|Daily is visible|Daily commits before offers|Daily survives UTC rollover|Daily late completion|Daily fails closed|Daily Shaq Meets Steph|Daily calendar rolls|Legacy .* drafts resume|Daily rejects a stale|Daily share description recovery|history updates pending postseason|history caps at 50|clipboard and native-share|copy and native share|image generation failure|first visit guide|player stats stay' --reporter=dot`.
- Published with `npx --yes vercel@latest deploy --prod --yes --scope preciadox`; Vercel reported Ready and retained the stable alias. An anonymous fetch returned HTTP 200 with THE DRAFT ROOM content, not an authentication page. Repeated the same 44 browser checks against the public alias with `PLAYWRIGHT_CHANNEL=msedge` and `PLAYWRIGHT_BASE_URL=https://98-0.vercel.app`: all passed. The remote override was cleared in `finally` after completion.
- Live coverage includes six-pick gameplay, completion/reload history, Daily lockout/cancellation/UTC rollover/cross-tab rejection, saved-description recovery, shared image/text contents, guide dismissal and compact mobile stats. Reviewed deployed desktop/mobile DAILY USED screenshots and long-name Daily PNGs with full challenge descriptions and footers visible. This deployment record and current-status documentation were updated locally after publication.
- Browser tests use isolated storage, not existing player saves. Public Daily enforcement remains browser-local and dependent on device time; old history without matching original records may lack descriptions. Full browser-suite coverage, physical devices, Safari/Firefox, actual messaging-app delivery and human balance/release acceptance remain unverified for this deployment.

### Daily descriptions in shared results, 2026-09-17 (local only)

- Scope: uncommitted follow-up from `7ff1999` in summary generation, progress storage, share-card presentation/styles, existing engine/browser tests and documentation. Preserved prior single-attempt, wording and mobile-stat changes. No deployment, commit or push.
- New Daily summaries snapshot challenge name and restriction from the original version-pinned attempt, with an unrestricted-pool description for original unthemed Dailies. Text, clipboard, text-file downloads, native-share payloads and square PNGs use those same details. Ordinary runs retain their previous output, and no removed attempt-kind labels return.
- Older summaries without descriptions can recover them using matching attempt ID/date/kind in a validated Daily ledger, including old calendar versions. Missing or corrupt ledger data does not block readable history; descriptions are not inferred from date alone. Stored optional description fields are validated. No season or postseason results are resampled.
- Passed `node --experimental-strip-types --test --test-name-pattern='share captions|progress unlocks' src/engine/run.test.ts` (two focused engine tests), `npm run typecheck`, `npm run build`, and `npm run test:browser -- tests/browser/collection.spec.ts tests/browser/daily.spec.ts --grep 'history caps at 50|Daily share description recovery|Daily commits before offers|history updates pending postseason|image generation failure' --reporter=dot` (14 local Edge checks across desktop and 320px mobile). Used a fresh production build with remote/reuse overrides cleared. Touched-file editor diagnostics were clear.
- The first browser run exposed footer overflow with the longest challenge description plus a long player name, and overly broad selectors matching the temporary export clone. Tightened roster spacing/type only on Daily exports with descriptions, scoped the selectors to the dialog, rebuilt and reran the same checks successfully. Reviewed both resulting 1800px square PNGs with the full description and footer visible; all overflow assertions passed.
- No live verification, full-suite run, real messaging-app delivery, physical-device, Safari/Firefox or human acceptance checks were performed. Older history without both saved details and an intact matching Daily ledger remains date-only. Public production is unchanged.

### Daily wording and share audit, 2026-09-17 (local only)

- Scope: follow-up on the uncommitted single-attempt changes from `7ff1999`. Updated current Daily rules in the game design and Phase 6/7 behavior documentation; clearly marked older validation as historical. Preserved existing source, mobile-stat changes, legacy-save compatibility and historical deployment records.
- Source audit found no practice wording in UI components or the player README. The existing legacy-Daily sharing test now checks history, the offscreen image-export content, result text, clipboard output, native-share text and the downloaded text file for the cleaned Daily caption. Both generated 1800px square PNGs were visually reviewed without the removed label.
- Passed `npm run test:browser -- tests/browser/collection.spec.ts --grep 'history caps at 50' --reporter=dot`: two local Edge checks, desktop and 320px mobile. Used the production build verified in the preceding entry, with no subsequent application-source changes and remote/reuse overrides cleared. Editor diagnostics for the expanded test and `git diff --check` passed. No new build or full-suite run was needed for this test/documentation-only follow-up.
- No deployment, commit or push. Internal historical attempt values remain supported but are not displayed. Native sharing used a controlled browser mock, not actual messaging-app delivery; physical devices and other browsers remain unverified.

### One Daily attempt per UTC day, 2026-09-17 (local only)

- Scope: uncommitted changes from `7ff1999` to the Daily start guard, popup, player guide, history/share presentation and focused tests. Preserved the existing mobile-stat edits in `src/app/globals.css`, `tests/browser/modes.spec.ts` and this document. No deployment, commit or push.
- The start guard checks every recorded attempt for today's UTC date inside the existing Web Lock before creating offers. Cancellation, completion, legacy versions and old retry records all consume that date. Rejected starts leave the saved run intact. The popup disables starts with DAILY USED; existing drafts and completed results remain readable without resampling or migrating saves.
- Removed visible practice wording from the Daily banner, records, guide, history, exported image and shared text. Historical kind/status values remain supported internally so old saves and records still validate. Updated the README's player-facing rule.
- Passed `node --experimental-strip-types --test src/engine/run.test.ts src/engine/daily.test.ts` (33 tests), `npm run typecheck`, `npm run build`, and 26 local Edge desktop/320px mobile checks using `npm run test:browser -- tests/browser/daily.spec.ts tests/browser/guide.spec.ts tests/browser/collection.spec.ts --grep 'Daily is visible|Daily commits before offers|Daily survives UTC rollover|Daily late completion|Daily fails closed|Daily Shaq Meets Steph|Daily calendar rolls|Legacy .* drafts resume|Daily rejects a stale|first visit guide|history caps at 50' --reporter=dot`. Browser checks used the fresh production build with remote/reuse overrides cleared. An initial environment-cleanup command exited before tests started; the corrected setup and browser run passed.
- Coverage includes cancellation/reload lockout, completed results, UTC rollover, corrupt/unavailable storage, legacy local/retry saves, stale second-tab rejection without replacing the committed save, guide dismissal and share-image metadata. Reviewed desktop/mobile DAILY USED screenshots; touched source/test editor diagnostics were clear.
- Remaining limitations: enforcement still uses browser-local storage and device time; clearing storage or switching browser/origin/device bypasses the local history. No live checks, full-suite run, physical-device, Safari/Firefox or human acceptance testing was performed for this change. Public production remains on the deployment recorded above.

### Compact mobile player stats, 2026-09-17 (local only)

- Scope: uncommitted changes from `7ff1999`, starting with a clean working tree. Mobile player rows use ten equal stat columns, 9px values and 7px labels above the values; sorting highlights the selected stat without moving its column. Desktop and hidden-stat HI IQ layouts are unchanged. No gameplay or save changes.
- Passed `npm run build` and `npm run test:browser -- tests/browser/modes.spec.ts --grep 'player stats stay' --reporter=dot`: two local Edge checks covering 320px, 390px, 760px and desktop 1440px, with overall/assists sorting, aligned stats and no stat clipping. Reviewed 320px, 390px and desktop screenshots; editor diagnostics were clear.
- No deployment, commit or push. Physical-device readability, Safari/Firefox and the full browser suite were not newly verified.

### Daily popup and background music deployment, 2026-09-17

- Published commit `7b51bc486ca38f512b1e0a00df86bcf57fec59d2` plus the uncommitted `.vercelignore` exclusion `public/audio/*.flac` to <https://98-0.vercel.app>; immutable deployment: <https://98-0-484zmm9m5-preciadox.vercel.app>. The initial working tree was clean. Scope: Daily popup actions and looping background music; no gameplay or save-format changes.
- The user confirmed rights/permission to publish the recording and authorized publishing the MP3 while excluding the original FLAC. No audio source files were removed. A local upload-rule assertion verified the exclusion and retained runtime MP3.
- Pre-publish checks passed: `npm test` (115 tests), `npm run typecheck`, `npm run build`, and `git diff --check`. VS Code test discovery returned no tests; the canonical npm suite ran successfully.
- Local and deployed Edge desktop/320px mobile runs each passed 46 checks, exit code 0: `npm run test:browser -- tests/browser/audio.spec.ts --reporter=dot` (28), then `npm run test:browser -- tests/browser/postseason.spec.ts tests/browser/daily.spec.ts tests/browser/collection.spec.ts --grep 'Daily is visible|Daily survives UTC rollover|Legacy drafts resume|Daily Shaq Meets Steph|six-pick draft|Daily commits before offers|history updates pending postseason|clipboard and native-share|copy and native share' --reporter=dot` (18). Local runs used the fresh production build with remote/reuse overrides cleared; deployed runs used the stable public alias. The remote override was cleared afterward.
- Verified the existing project link and `npx --yes vercel@latest project inspect 98-0 --scope preciadox`: repository root, Next.js preset, Node 24.x and default build/output settings. Published with `npx --yes vercel@latest deploy --prod --yes --scope preciadox`; the stable alias was retained. No Git push or production-branch change was needed.
- Anonymous requests passed: game HTTP 200 with current title and game content, MP3 HTTP 200 with the expected 2,039,022 bytes, original FLAC HTTP 404. An initial HTTP probe failed on an obsolete title expectation; the assertion was corrected against current source and passed. This was a probe error, not a deployment failure.
- Live coverage includes music fetch/decode, loop mechanics, gesture startup, mute/hidden-tab behavior, sound/haptic regressions, Daily cancellation and retry persistence, draft completion, postseason history, actual exported result content and sharing fallbacks. Deployed desktop/mobile Daily screenshots and the mobile perfect-result share preview were reviewed. Browser tests used isolated storage; no player data was cleared.
- No commit or push was performed. This status entry is a post-deployment documentation change. The full browser suite, subjective listening, physical devices, Safari/Firefox, real messaging-app delivery and comprehensive accessibility/balance acceptance were not newly verified. Rights confirmation is user-provided, not an independent license audit.

### Background music loop, 2026-09-17 (local only)

- Scope: uncommitted working-tree changes in `src/lib/background-music.ts`, `src/lib/game-audio.ts`, the existing audio browser tests and documentation, using the previously prepared MP3. Started with the compression status edit and untracked audio assets; preserved both. No gameplay/save-format changes or dependency additions.
- Fetches and decodes `/audio/background-music.mp3` once after an enabled user gesture. Blends the last three seconds with the first three seconds per channel using complementary linear gains, then loops natively from the end of the blended head. The initial intro plays in full; native loop points avoid timer scheduling gaps. Music fades in over 750 ms at 25% gain beneath the existing effects/master chain.
- Shared mute and tab hiding suspend the audio context, retaining music position; returning or unmuting resumes it. Page exit suspends audio, cleanup aborts loading and disconnects music, and late loads cannot start while muted/hidden. Music errors are visible without blocking effects or gameplay.
- Passed `npm run typecheck`, `npm run build`, and `npm run test:browser -- tests/browser/audio.spec.ts --reporter=dot`: 28 local desktop/320px mobile Edge checks, exit code 0. Fresh production test server; remote URL and server reuse overrides cleared. VS Code test discovery found no tests, so validation used the existing CLI. Editor diagnostics were clear.
- New checks cover synthetic stereo crossfade waveforms across three repeated boundaries, actual MP3 fetch/decode and loop settings, gesture-only startup, one music source/context, mute persistence, position-preserving suspension, visible-tab resume, delayed-load mute races, missing music, effects and draft continuity. Existing sound/haptic regressions also passed. Synthetic waveform checks establish transition mechanics, not subjective musical quality.
- No deployment, commit or push. Full engine/browser suites, subjective listening, physical devices and Safari/Firefox were not newly tested. Public-use rights and moving/excluding the preserved FLAC from public deployment remain publication prerequisites.

### Background music compression, 2026-09-17 (local only)

- Scope: working tree contained only untracked `public/audio/` before this status edit. Converted the user-provided `public/audio/background-music.flac` to `public/audio/background-music.mp3`; original retained unchanged. No application code or dependency manifests changed.
- FFmpeg conversion used `-map 0:a:0 -vn -c:a libmp3lame -q:a 4 -ar 44100`: stereo, variable bitrate, approximately 152.5 kb/s, full 1:47 track, no embedded artwork or volume adjustment. Existing attribution metadata retained. FFmpeg tooling was installed under the system temporary directory, outside the project.
- Size decreased from 41,404,570 bytes (39.49 MiB) to 2,039,022 bytes (1.94 MiB), approximately 95% smaller. Local full MP3 decoding with `ffmpeg -v error -xerror -i public/audio/background-music.mp3 -f null NUL` passed with no errors.
- Not connected to gameplay; no deployment, commit or push. Browser playback, subjective listening and seamless looping were not checked. Metadata identifies a commercial recording; public use requires appropriate music rights. Both files remain in `public/audio/` and would be publicly served if deployed; review rights and source-file placement before publication.

### Daily popup actions, 2026-09-17 (local only)

- Scope: uncommitted working-tree changes from a clean tree in `src/components/draft-room.tsx` and the existing Daily browser tests. START DAILY replaces START PRACTICE, the bottom Cancel dismiss button is removed, and CANCEL DAILY uses the existing new-run action. Retry eligibility, Daily records, save formats and gameplay rules are unchanged.
- Passed `npm run typecheck`, `npm run build`, and 10 local Edge desktop/320px mobile checks against the fresh production build. Browser commands: `npm run test:browser -- tests/browser/daily.spec.ts --grep 'Daily is visible|Daily commits before offers|Daily survives UTC rollover' --reporter=dot` (6 passed) and `npm run test:browser -- tests/browser/daily.spec.ts --grep 'Legacy drafts resume|Daily Shaq Meets Steph' --reporter=dot` (4 passed), both exit code 0.
- Verified X dismissal preserves the current run, cancellation returns to normal mode across reload, commitments survive cancellation, same-day retries remain practice, completed records persist, and legacy drafts remain unchanged on dismissal. Desktop/mobile popup screenshots reviewed; source/test editor diagnostics were clear. VS Code test discovery found no Playwright tests; the project CLI ran them successfully.
- No deployment, commit or push. Full engine/browser suites, physical devices and Safari/Firefox were not newly tested.

### Frozen names and square preview deployment, 2026-09-17

- Published clean commit `84d0551643a1db6eb7edeabae84d9c533f3508f6` to <https://98-0.vercel.app>; immutable deployment: <https://98-0-fgz5c5yps-preciadox.vercel.app>. Scope includes the 160px frozen player-name/header column and the result popup's square PNG preview. No save or gameplay-rule changes.
- Pre-publish checks passed: `npm test` (115 tests), `npm run typecheck`, `npm run build`, `git diff --check`, and 14 local Edge desktop/320px mobile checks against the fresh production build. Browser command: `npm run test:browser -- tests/browser/postseason.spec.ts tests/browser/daily.spec.ts tests/browser/collection.spec.ts --grep 'six-pick draft|Daily commits before offers|history updates pending postseason|history caps|clipboard and native-share|copy and native share|image generation failure' --reporter=dot`.
- Confirmed the existing local project link and `npx --yes vercel@latest project inspect 98-0 --scope preciadox` settings: repository root, Next.js, Node 24.x and default build/output. Published with `npx --yes vercel@latest deploy --prod --yes --scope preciadox`; the stable alias was retained. Anonymous `Invoke-WebRequest` returned HTTP 200 with game content.
- Repeated the same 14 browser checks against the public alias with `PLAYWRIGHT_CHANNEL=msedge` and `PLAYWRIGHT_BASE_URL=https://98-0.vercel.app`: all passed. Cleared the remote override afterward. Checks cover drafting, Daily/reload persistence, postseason history, byte-identical preview/download PNGs and sharing fallbacks.
- An additional isolated Edge probe on production confirmed the 160px name width, fixed name/header positions while stats scroll, clicking a frozen name opens player selection, and unchanged mobile cards without horizontal overflow. Reviewed deployed desktop/mobile table and share-preview screenshots. All browser checks used isolated storage; no existing player data was cleared.
- No commit or push was performed during deployment; this status record is a post-deployment documentation change. The full browser suite, physical devices, Safari/Firefox, actual messaging-app delivery and comprehensive accessibility/balance acceptance were not newly verified.

### Square share preview, 2026-09-17 (local only)

- Scope: uncommitted working-tree change. The result popup displays the same generated 1800-by-1800 PNG used for download and native file sharing, scaled to a square at the available width. Object URLs are released on close; export failures retain the existing card and text fallback. Existing player-table edits were preserved.
- Passed `npm run typecheck`, `npm run build` and 10 local Edge desktop/320px mobile checks with `npm run test:browser -- tests/browser/collection.spec.ts --grep 'history updates pending postseason|history caps|clipboard and native-share|copy and native share|image generation failure' --reporter=dot`. Checks confirm byte-identical preview/download PNGs, square dimensions, long-name exports and sharing fallbacks. Desktop/mobile screenshots were reviewed; editor diagnostics reported no errors in the changed source/test files.
- No deployment, commit or push. Physical devices, Safari/Firefox and actual messaging-app delivery were not tested.

### Frozen player names, 2026-09-17 (local only)

- Scope: uncommitted working-tree changes to `src/app/globals.css`, starting from a clean tree. Above 760px, the visible-stats table uses a 160px name column with sticky names and name-sort header, opaque backgrounds and matching header layering. Mobile cards and hidden-stat layouts retain their existing rules.
- Local validation: an isolated Edge CSS probe passed width, pinned-name/header, scrolling-stat and mobile-position checks. A separate Playwright probe against the actual local Next.js dev server passed at 1440px and 320px, including selecting a player by the frozen name and no mobile horizontal overflow. Desktop/mobile screenshots reviewed; CSS diagnostics and `git diff --check` passed.
- Integrated-browser click automation was inconclusive; the isolated Edge app check passed. No production build, full suite, deployed checks, Safari/Firefox or physical-device checks were run. No deployment, commit or push was performed.

### Player guide deployment, 2026-09-17

- Published the first-visit guide and header help button to <https://98-0.vercel.app>; immutable deployment: <https://98-0-f0rhqqkrf-preciadox.vercel.app>. Gameplay rules, supported saves and saved results are unchanged; dismissal uses the separate `98-0-guide-v1` preference.
- Passed `npm test` (115 tests), `npm run typecheck`, `npm run build` and `git diff --check`. All 128 Edge browser checks passed across desktop and 320px mobile: `npm run test:browser -- tests/browser/daily.spec.ts --project=desktop` and `--project=mobile` (20 each), then the other eight browser spec files with each project (44 each). An earlier combined run was interrupted by terminal reuse and is not counted as passing evidence.
- Confirmed the existing project using `npx --yes vercel@latest project inspect 98-0 --scope preciadox`, then published with `npx --yes vercel@latest deploy --prod --yes --scope preciadox`. Anonymous `Invoke-WebRequest` returned HTTP 200 with game and guide content.
- With `PLAYWRIGHT_CHANNEL=msedge` and `PLAYWRIGHT_BASE_URL=https://98-0.vercel.app`, ran `npm run test:browser -- tests/browser/guide.spec.ts tests/browser/postseason.spec.ts tests/browser/daily.spec.ts tests/browser/collection.spec.ts --grep 'first visit guide|Escape dismisses|guide remains|returning player header|six-pick draft|Daily commits before offers|history updates pending postseason|clipboard and native-share|copy and native share'`: 18 passed, exit code 0. The remote override was cleared afterward.
- Reviewed desktop/mobile screenshots; verified dismissal, reopening, keyboard focus, blocked guide storage, header fit and saved-draft preservation. Physical devices, Safari/Firefox, real messaging-app delivery and comprehensive accessibility acceptance remain unverified. Source changes were not committed or pushed at the time of this deployment record.

### Reel feedback and collection polish

Published from clean commit `0ce9800`: continuous reel feedback, compact mobile collection controls, updated brand mark and square 1800-by-1800 result-image exports. Immutable deployment: <https://98-0-6js7hbj8p-preciadox.vercel.app>.

An Android PWA user reported feeling the longer enable pulse and player-lock feedback, but insufficient reel feedback. Spins and team/era rerolls now request one continuous 750 ms vibration, sharing `REEL_SPIN_DURATION_MS` with the animation. Other patterns are unchanged. Focused typecheck, build and 20 local audio checks passed; controlled-clock checks verified busy state at 749 ms and completion at 750 ms with one full-duration vibration request. Full-spin physical feedback remains unverified.

Pre-publish validation passed: `npm test` (115 tests), `npm run typecheck`, `npm run build`, `git diff --check`, and `npm run test:browser -- --reporter=dot` (120 checks, 5.9 minutes). Anonymous production access returned HTTP 200 with the game title and manifest. The deployed command passed 36 checks (exit code 0, 1.8 minutes):

```powershell
npm run test:browser -- tests/browser/audio.spec.ts tests/browser/postseason.spec.ts tests/browser/daily.spec.ts tests/browser/collection.spec.ts --grep 'haptics|vibration|sound|audio|legacy volume|collection toolbar|Almanac unlocks|history caps|six-pick draft|Daily commits before offers|history updates pending postseason|clipboard and native-share|copy and native share' --reporter=dot
```

Coverage included drafting, Daily/reload persistence, postseason history, collection layouts, long-name square exports, sharing fallbacks and audio/haptic API behavior. Local desktop/mobile and deployed result-image/mobile-toolbar screenshots were reviewed. The remote override was cleared; no player data was cleared or migrated. Physical vibration, native installation, Safari/Firefox, real messaging delivery and human balance acceptance remain open.

### Haptic diagnostics

Published the two-file haptic/test working-tree update to <https://98-0-lbkbko9q6-preciadox.vercel.app>. Enabling vibration requests two 180 ms pulses separated by 100 ms. Rejected requests and API exceptions show a status message; normal gameplay patterns were unchanged in this update. This diagnosed an Android PWA report, not a confirmed physical-device fix. Accepted requests can still be suppressed by hardware or OS settings.

`npm test` passed 115 tests; typecheck, build and `git diff --check` passed. `npm run test:browser -- tests/browser/audio.spec.ts --reporter=dot` passed 20 local checks. Anonymous production access returned HTTP 200 with title `98-0 | The Draft Room`. The deployed command passed 30 checks (exit code 0, 1.6 minutes):

```powershell
npm run test:browser -- tests/browser/audio.spec.ts tests/browser/postseason.spec.ts tests/browser/daily.spec.ts tests/browser/collection.spec.ts --grep 'haptics|vibration|sound|audio|legacy volume|six-pick draft|Daily commits before offers|history updates pending postseason|clipboard and native-share|copy and native share' --reporter=dot
```

Deployed desktop/mobile screenshots were reviewed; the remote override was cleared. No saves were cleared or migrated. Phone vibration delivery remained unverified at this stage; the suggested diagnostic was to reload and toggle vibration off then on.

### Haptics, share-card text and brand assets

Published from clean commit `78a0f1bf4228691597d9fcfe6dfd7f72dda53464` to <https://98-0-64zni1mis-preciadox.vercel.app>, including haptics, larger share-card text and updated brand mark/icons.

Haptics use `98-0-haptics-v1`, independent of mute and run saves. They default on unless reduced motion is requested; an explicit saved choice takes precedence. Feedback requires interaction, stops when hidden and does not replay on save load. Unsupported APIs hide the control, including Safari on iPhone/iPad. Rejected or unavailable vibration never blocks gameplay; installation adds no native haptic capability.

Initial local typecheck, build and all 20 audio checks passed, including eight new haptic checks for patterns, independent mute, persistence, reduced-motion defaults, storage failures, background cancellation, saved results and unsupported APIs. Screenshots were reviewed; vibration calls were mocked.

Release checks passed: `npm test -- --test-reporter=dot` (115 tests), typecheck, build, `git diff --check`, and `npm run test:browser -- --reporter=dot` (118 local checks). The fresh-build run superseded a local run affected by static-asset HTTP 500 errors during concurrent workspace changes. Anonymous production access returned HTTP 200 with the manifest. A raw-HTML coach-text probe did not match; rendered gameplay was subsequently verified by the live suite.

The deployed command passed 44 checks (3.0 minutes):

```powershell
npm run test:browser -- tests/browser/audio.spec.ts tests/browser/install.spec.ts tests/browser/postseason.spec.ts tests/browser/daily.spec.ts tests/browser/collection.spec.ts --grep 'haptics|vibration|sound|audio|legacy volume|install|standalone|Safari|six-pick draft|Daily commits before offers|history updates pending postseason|clipboard and native-share|copy and native share' --reporter=dot
```

Coverage included gameplay, audio/haptics, Daily and saved-result persistence, install assets, sharing fallbacks and PNG output. Deployed header and exported-result screenshots were reviewed. The remote override was confirmed absent afterward. No storage or save formats changed. Physical haptics, native installation, Safari/Firefox, real messaging delivery and human balance acceptance remained unverified.

### Installable app

Published from clean commit `8811e8c8f9e33fa081b1de16285a29ad2ecb6fcc` to <https://98-0-rlv7kyqh8-preciadox.vercel.app>.

Supporting browsers can install **98-0** into a standalone window. Chrome/Edge show the Install control when a native offer is available; eligibility, engagement, prior dismissal, private browsing and device policy affect availability. iPhone/iPad Safari shows Share > Add to Home Screen guidance. Controls are hidden in standalone mode. No accounts, backend, service worker, offline cache or storage migration were added; the root URL and save formats stayed unchanged.

Initial typecheck, build and `npm run test:browser -- tests/browser/install.spec.ts` passed, with 14 local checks for manifest/PNG dimensions, prompt outcomes, installed state, Safari guidance, drafting and reload. Chromium reported no installability errors in disposable regular profiles; Playwright incognito contexts correctly rejected installation. Screenshots were reviewed. Native prompt lifecycle and Safari detection used mocks, not actual OS installation.

Pre-publish checks passed: `npm test` (115 tests), typecheck, build, `git diff --check`, and 24 local checks. Anonymous production access returned HTTP 200 with title and manifest. The same command passed 24 deployed checks (exit code 0):

```powershell
npm run test:browser -- tests/browser/install.spec.ts tests/browser/postseason.spec.ts tests/browser/daily.spec.ts tests/browser/collection.spec.ts --grep 'install|standalone|Safari|six-pick draft|Daily commits before offers|history updates pending postseason|clipboard and native-share|copy and native share'
```

Deployed screenshots were reviewed and the remote override cleared. A full-suite rerun, physical-device installation and home-screen launch, Safari/Firefox, messaging delivery and human balance acceptance remained separate work.

### Audio simplification

Published to <https://98-0-ayk9d5flv-preciadox.vercel.app>. Removed volume settings and the test-sound popover. Enabled audio uses fixed 100% master gain with the existing compressor; mute persists, legacy volume values are ignored and run saves are unchanged.

`npm test` passed 114 tests; typecheck, build and `git diff --check` passed. `npm run test:browser -- tests/browser/audio.spec.ts` passed 12 local checks, with screenshots reviewed. Anonymous public access returned HTTP 200. The audio, postseason, Daily and collection browser files filtered by `sound|audio|legacy volume|six-pick draft|Daily commits before offers|history updates pending postseason|clipboard and native-share|copy and native share` passed 22 deployed checks (exit code 0), superseding an interrupted live run. The remote override was cleared. A full browser rerun, subjective listening, physical devices, Safari/Firefox and real messaging delivery remained unverified for this narrow update.

### Initial public playtest

Published to Vercel project `preciadox/98-0`, with GitHub integration enabled and the stable public alias available without authentication.

Recorded checks passed: 114 engine tests, typecheck, production build and 94 local desktop/320px Edge checks. Anonymous HTTP access returned 200. Eight deployed checks passed for six-pick drafting/playback, Daily completion/reload/practice, postseason history/PNG exports and sharing fallbacks. Checked runtime dependencies had no known CVEs; this was not a comprehensive security audit or human playtest.

Earlier [Phase 7 validation](progress/PHASE7_PROGRESS.md#validation) recorded 112 engine tests and 92 desktop/mobile Edge checks, plus typecheck and production build. That is phase-specific historical evidence, not the latest deployment validation or balance sign-off.

## Rules and compatibility snapshot

This technical snapshot records the rules as of 2026-09-17. The [game design](design/GAME_DESIGN.md) contains the broader rules and roadmap; [Phase 6](progress/PHASE6_PROGRESS.md) documents Daily compatibility, and [Phase 7](progress/PHASE7_PROGRESS.md) documents collection, storage, spoilers and sharing fallbacks.

- New runs use `season-7` / `mid-iq-3` / `conditional-score-3`: 135% base usage cap plus coach adjustments, 1.5% offensive efficiency lost per usage point above the cap (0.45 floor), and qualification at 45 wins after all 82 games are revealed. Higher entry tiers remain 65/70/75 wins. Postseason starts explicitly and preserves the regular-season record.
- Identical draft actions and pinned seed, engine, data and random/score versions reproduce the same run. Different lineups can produce different results from shared game draws. Playback reveals a simulated, saved result without new randomness.
- Rivalry evidence and postseason rules are versioned separately. Old saves without rivalry metadata stay unannotated, but qualifying saved seasons can enter postseason. Regular-season and postseason playback cursors are separate.
- Recovery permits at most two machine epsilons of cross-runtime rounding in win probabilities while preserving saved values. Ratings, scores, winners and other state remain exact.
- Saves pin `iqMode` and `iqVersion: iq-1`. Saves without them retain Mid IQ behavior and original results. The mode-aware wrapper preserves frozen baseline math; No IQ uses `no-iq-1` for previews, games and recovery. HI IQ hidden information is a play mode, not protection against inspecting downloaded data or browser storage.
- Supported `season-1` through `season-4` saves require 60 wins; `season-5` and `season-6` require 40; `season-7` requires 45. The 135% cap began in `season-4`, and the stricter overload penalty in `season-6`. Older saves are never resampled or relabeled; frozen reports retain original versions and thresholds.
- Local Daily uses Mid IQ and cycles indefinitely through 56 themes, reshuffled each cycle from September 17, 2026 UTC. Retries are practice; attempts/results remain local and unverified. Browser storage, Web Locks and HTTPS or localhost are required.
- Completing an 82-game simulation unlocks all 12 Coach Almanac systems. History retains 50 recent seasons and per-mode personal bests. Only revealed results are exported or shared.

## Historical research

[Mid IQ core release](release/MID_IQ_CORE_RELEASE.md), calibration reports and earlier phase reviews preserve historical evidence, not current-build acceptance. See the [documentation index](README.md) for the archive and [research compatibility](README.md#research-compatibility) for path migration details. Preserve frozen JSON, superseded and failed results, raw/reference data and research scripts for reproducibility.

Generated build/test output, Python bytecode and local environments are ignored. Do not commit them or delete active server output during documentation cleanup.
