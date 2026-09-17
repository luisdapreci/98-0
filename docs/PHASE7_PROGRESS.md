# Phase 7: Almanac, History and Sharing

Completed for local scope on 2026-09-17. No accounts, friend service or public ranking were added; Phase 8 remains deferred.

## Behavior

- All 12 Coach Almanac systems unlock when the first 82-game season finishes simulation, including zero-win seasons and seasons awaiting postseason. The unlock is independent of the active save.
- History retains the 50 most recent completed seasons with coach, six-player lineup, IQ mode, engine version, regular-season record, differential and longest winning streak. Play-in and main-bracket records, elimination, championship and perfect-run status remain separate.
- A season enters visible history after its playback is revealed. Postseason completion updates that same entry after its playback finishes, without changing its original archive date. A confirmed replacement archives already simulated results; an unstarted postseason remains pending. Incomplete drafts are not archived.
- Personal bests retain the most wins, highest differential and longest winning streak separately for each IQ mode, even after the original entry leaves the recent 50. Equal values preserve the existing best. Legacy saves without mode metadata remain Mid IQ.
- New drafts and Daily starts preserve progress under `98-0-progress-v1`. Web Locks serialize read/merge/write operations where available. Malformed data and quota failures are reported without deleting existing progress. Progress UI updates do not rewrite the active run save.
- Almanac and history are temporarily inaccessible during HI IQ drafting to avoid revealing protected scouting information; both become accessible at Start Season. The Almanac labels coach effects inactive in No IQ.
- Result previews and plain text derive from the archived summary, not a new simulation. Daily date and local/practice status are included. Every export is explicitly local, unverified and not a ranking; authoritative Daily status remains in the separate Daily ledger.
- `html-to-image` is dynamically imported for PNG export. An offscreen 720px layout renders at 2x resolution, independent of mobile preview width. Fonts finish loading before export, and long names wrap. Image and text downloads, clipboard text and native file/text sharing have explicit success, cancellation and failure feedback. Selectable text remains available without clipboard, native sharing or image export.

## Validation

| Check | Result |
| --- | --- |
| `npm test` | PASS, exit 0: 112 engine tests |
| `npm run typecheck` | PASS, exit 0 |
| `npm run build` | PASS, exit 0, including TypeScript validation |
| `PLAYWRIGHT_CHANNEL=msedge npm run test:browser` | PASS, exit 0: 92 browser checks, desktop 1440x1000 and mobile 320x800 |
| Dependency install audit | 0 vulnerabilities reported after adding `html-to-image` |

New checks cover unlocks regardless of record, reset/reload persistence, deduplication, 50-entry retention, per-mode bests, pending-postseason spoiler protection, exact postseason export parity, HI IQ access, corruption/quota failure, clipboard/native-share absence, success/rejection/cancellation and image-generation failure. PNG decoding checks 1440px width, nonblank pixels and content across both halves of the image. Desktop/mobile screenshots and exported perfect-run and long-name PNGs were inspected.

The full browser run exposed a fixture setup race: tests could overwrite local storage before initial hydration and the Daily refresh completed. The shared loader now waits for those operations before injecting its save. An initial narrow-column PNG was corrected by laying out the export before capture rather than only changing the cloned root width.

## Boundaries

Local storage and the device clock are not trusted. Clearing site data removes progress. Existing overwritten runs cannot be reconstructed; a supported active save is imported as it is recovered/revealed. History stores summaries, not replay archives. Without Web Locks, ordinary local persistence remains available but concurrent-tab writes are not serialized.

Browser tests use installed Edge and emulated mobile dimensions. Native share success/cancellation and clipboard outcomes are capability-controlled tests; real messaging-app delivery, physical mobile devices, Safari and Firefox are not verified. Human playtesting and Phase 9 release/balance gates remain open.