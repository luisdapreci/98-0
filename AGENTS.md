<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Documentation Updates

- Keep [README.md](README.md) focused on the game: its premise, rules, modes, features, player-facing limitations and local setup. Do not add dated status updates, deployment logs, test counts or validation transcripts to it.
- Use [docs/STATUS.md](docs/STATUS.md) for all project status updates, deployment records, validation results and outstanding work. Read it before reporting current status; add dated entries newest first and update its current-status summary when the latest recorded state changes.
- Record the scope, source commit or working-tree state, immutable deployment URL when applicable, checks actually run, results and remaining limitations. Distinguish local from deployed checks and historical evidence from new verification; preserve prior records.
- Keep detailed phase reports and release evidence in their existing documents and link to them from [docs/STATUS.md](docs/STATUS.md). The README should link to status rather than duplicate it. Documentation edits alone do not authorize deployment.

## Vercel Playtest Deployment

This section is maintained by the project, outside the generated Next.js block. Deployment settings below were verified on 2026-09-17.

### Project And Public Access

- Stable public URL: <https://98-0.vercel.app>. Use this URL in shared result text and playtester invitations, not a deployment-specific URL or localhost.
- Vercel team/scope: `preciadox`; project: `98-0`; dashboard: <https://vercel.com/preciadox/98-0>.
- Project ID: `prj_syeOx1sQASaIcYcADSoizyvqJuOd`; organization ID: `team_LwuzAXXOcnvWtnRgwwGRzzhL`. These are identifiers, not credentials.
- Linked GitHub repository: <https://github.com/luisdapreci/98-0>. Git integration is enabled. A push to the configured production branch can publish changes; verify that branch in Vercel settings rather than assuming its name.
- This is an intentionally public playtest: anyone with the link can play without authentication. Do not enable deployment protection on the public alias or add accounts without approval. It is not full balance, human-playtest or release acceptance.

### Build And Storage Contract

- Deploy from the repository root (`.`), using the Next.js framework preset, Node.js `24.x`, `npm run build` (or `next build`) and the default Next.js output directory. Keep `package-lock.json` in the deployment; do not change to static export or upload `.next` manually.
- The game uses bundled processed data and browser-local state. No backend database, gameplay secrets or runtime environment variables are currently required. Deferred leaderboards are not part of this deployment.
- Saves, Daily attempts, audio preferences and history belong to the browser and origin. They do not sync across devices or transfer from localhost/preview URLs. Clearing site data removes them. Preserve the stable production alias and supported version-pinned saves; never resample completed results during deployment changes.
- HTTPS is required for production browser capabilities such as Web Locks and clipboard/share APIs. Keep copy/download fallbacks; native sharing depends on the browser/device and receiving app.
- `.vercel/project.json` links the local folder to the existing project. `.vercel/` and `.env*` are ignored by Git. Never commit authentication tokens, downloaded secrets or environment files.
- `.vercelignore` excludes generated output, local tooling, docs/research, tests, scripts and raw/reference data from CLI uploads. Retain `src/`, `public/`, `data/processed/`, dependency manifests and build configuration. Revisit exclusions if runtime/build imports change. Excluded research files are not available to run the offline research/test suite on Vercel.

### Before Publishing

Publishing updates the game used by playtesters. Deploy only when the user requests or authorizes a live update; a code/documentation edit alone is not a deployment request. Do not commit, push, create another Vercel project, change domains or incur paid services without authorization.

1. Inspect `git status --short` and relevant diffs. CLI deployment uploads the current working tree, including uncommitted source; do not unintentionally publish unrelated changes or revert user work.
2. Run the checks below against the exact source being published. Stop on failures. For a narrow follow-up, use the relevant browser files; for a release candidate, run the full suite.
3. Confirm the local project link matches the identifiers above. Inspect settings with `npx --yes vercel@latest project inspect 98-0 --scope preciadox`. If unlinked, use `npx --yes vercel@latest link --project 98-0 --scope preciadox` rather than creating a new project.

```powershell
Remove-Item Env:PLAYWRIGHT_BASE_URL -ErrorAction SilentlyContinue
npm test
npm run typecheck
npm run build
$env:PLAYWRIGHT_CHANNEL = 'msedge'
npm run test:browser
git diff --check
```

Run commands individually and check each exit code; PowerShell does not automatically stop after a failed native command. Browser tests require the production build and installed Edge (or an installed Playwright Chromium with the channel override unset). Local tests start their own production server on port 4180; use `PLAYWRIGHT_PORT` for another free port. Do not reuse a stale server/build as validation of new code.

### Publish And Verify

If authentication is needed, run `npx --yes vercel@latest login` and let the user complete browser authentication. Never request or print a token/password. Once the existing project link is verified and publication is authorized:

```powershell
npx --yes vercel@latest deploy --prod --yes --scope preciadox
```

Record the immutable deployment URL and confirm the alias is still <https://98-0.vercel.app>. CLI success alone does not establish public access or working gameplay. Request the public URL without Vercel credentials and require HTTP 200 on the game, not an authentication page; then run deployed browser checks:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'msedge'
$env:PLAYWRIGHT_BASE_URL = 'https://98-0.vercel.app'
try {
  npm run test:browser -- tests/browser/postseason.spec.ts tests/browser/daily.spec.ts tests/browser/collection.spec.ts --grep 'six-pick draft|Daily commits before offers|history updates pending postseason|clipboard and native-share|copy and native share'
  if ($LASTEXITCODE -ne 0) { throw 'Deployed browser checks failed.' }
} finally {
  Remove-Item Env:PLAYWRIGHT_BASE_URL -ErrorAction SilentlyContinue
}
```

`PLAYWRIGHT_BASE_URL` disables the local test server. Always clear it afterward so later local tests cannot silently test an old deployed build. The suite uses isolated browser storage; do not test by clearing a real user's saves. Verify relevant desktop/mobile layouts, reload persistence and actual result content. Shared text must include `https://98-0.vercel.app` via `resultText` in `src/engine/progress.ts`; native-share mocks do not prove actual messaging-app delivery.

If a deployment fails, inspect its build logs with `npx --yes vercel@latest inspect <deployment-url> --logs`. If live checks fail, report the failed flow and deployment URL; do not claim success. Identify the last known-good deployment and obtain authorization before rolling back or replacing production. Never repair a deployment by deleting player data or relaxing save validation.

Record deployment scope, commands, results and remaining limitations in [docs/STATUS.md](docs/STATUS.md), not the README. Link any detailed release note from that status entry. Use dated evidence, not permanent test-count requirements. Physical devices, Safari/Firefox, real messaging-app delivery, comprehensive security/accessibility and human balance acceptance remain separate validation work. See [project status](docs/STATUS.md) and [the release scorecard](docs/release/RELEASE_SCORECARD.md).
