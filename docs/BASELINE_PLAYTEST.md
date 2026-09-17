# Historical Season-3 Baseline Playtest

Date: 2026-09-15. Status: authorized preparation for the then-current build; no participants tested. The user approved exploratory feedback with "lets do it". Balance-model research remains paused.

**Historical protocol, not current-build readiness:** new runs now use `season-7`, with a 135% base usage cap, stricter overload penalty and 45-win qualification. The fingerprint, local URL and technical evidence below belong to the original 115%-cap `season-3` baseline. The URL records a past local session, not a maintained preview. Before using this protocol on the current game, register the exact tested build, update version-dependent instructions and rerun readiness checks. Do not pool versions or overwrite the original evidence. The user's shared screenshot and product preference are informal feedback, not B01 consent or a completed formal session.

## Purpose

The instructions below are retained for the original baseline only. See [current rules](GAME_DESIGN.md) and [latest functional validation](PHASE7_PROGRESS.md) before registering a new tested build.

Find the most important problems in draft decisions, outcome credibility and willingness to play again in the existing game. Observe actual behavior before choosing more balance research. This is not the [release scorecard](RELEASE_SCORECARD.md)'s frozen-finalist pilot, does not consume its participants or acceptance attempt, and cannot pass B1, B2, P1 or E1. No hypotheses about historical turnover estimates are shown to participants.

Test the unchanged `season-3 / mid-iq-2 / conditional-score-3` game. Preserve all historical players, available coaching and reroll resources. No participant-specific tuning, rigged outcomes, selected winning seeds or mid-study UI changes. If a blocking bug requires a fix, stop recruitment, preserve observations and explicitly identify any later session as a different build.

## Sessions

Recruit six consenting adults familiar with NBA basketball: three who regularly play strategy games and three casual players. Use anonymous identifiers B01-B06. The target groups in the observation file are recruitment slots, not claims about real participants. Confirm experience before starting. Do not replace a participant merely because they lose, dislike the game, need help or withdraw.

Allow about 40 minutes per person: introduction, two self-directed runs, an optional 10-minute free period, then a short interview. A run means drafting six players and reaching the 82-game result. Do not impose a speed target or require thinking aloud; both can distort behavior. Quiet observation is preferred. Time the active draft and season portions separately and note interruptions. A player may stop at any time. Record unfinished runs rather than excluding them.

Use a dedicated browser profile/context with empty game storage per participant. Do not clear the developer's or another participant's save. Use the same tested build, viewport/device choice and facilitator script; record differences. Normal randomly generated runs are intentional for this exploratory baseline: record run identifiers/seeds after the run, never preview or choose outcomes. This is not a paired policy comparison or a controlled estimate of win-rate differences.

## Consent and Introduction

Read this privately before opening the game:

> We are testing a basketball game, not your basketball knowledge or skill. Participation is voluntary, and you can stop or skip any question. With your permission, I will take anonymous notes about your choices and experience. We do not need your name or contact information, and we will not record audio or video. Is that okay?

After affirmative consent:

> Please play through two runs as you normally would. You can use any controls the game offers, take your time, or stop whenever you prefer. I will mostly observe. Let me know if you get stuck.

Do not explain qualification, lineup formulas, optimal strategy, where controls are, or what a loss "means" before observation. Do not call the game balanced, difficult or realistic. If someone requests help, first ask "What were you expecting to happen?" Give only the minimum help necessary to proceed, and record what was said. Never let the desire for unassisted completion prevent helping someone who is uncomfortable or blocked.

## What to Record

Use [the observation record](BASELINE_PLAYTEST_OBSERVATIONS.json). Only enter real observations; keep unavailable answers and unfinished metrics null. Do not put names, emails, recordings or unrelated browser contents in the file. Store only on the facilitator's machine, do not commit participant-level notes, and delete participant notes after the anonymized synthesis or within 30 days of the session, whichever is sooner. Keep only non-identifying aggregate findings longer.

For each session, record confirmed experience group, consent, session date, tested-build reference, browser/device/viewport, and any technical interruption. For each run, append a record containing:

- Run number, completion or withdrawal, active draft/season seconds and interruptions.
- Run seed/id, coach, picks, reroll use, wins and qualification when available. Observe or consult only that participant's completed run save; do not reveal future results during playback. Missing observations stay null.
- Help requests with the exact assistance given; navigation or input blocks; reload/data loss; confusing labels or inaccessible controls.
- Concrete decision moments: available alternatives, chosen option, what the participant said they were trading off, and hesitation or backtracking. Do not infer a reason from the pick alone.
- Reaction to results, especially the first loss and final outcome; distinguish an observed reaction, an exact quote and the facilitator's interpretation.

The browser save key is `98-0-draft-v1`. Facilitators may inspect the run metadata after the run if needed, but participants should never need developer tools. Do not import saves, run synthetic drafts or expose precomputed outcomes in human sessions. No automatic analytics or data transmission is added by this study.

After run two, before asking evaluative questions, say only:

> The required part is finished. We have up to ten minutes of free time; you can do whatever you prefer, including leave.

Leave the game available without suggesting another run or offering a reward for one. Record whether a third run's first player pick occurs voluntarily, the elapsed time, and any facilitator prompt or technical obstacle. Starting a new run or choosing a coach alone is not a third-run first pick. A prompted attempt is not voluntary replay. Free-period continuation is exploratory and can be affected by observation or session fatigue; do not treat it as retention.

## Interview

Ask after the free period so questions do not influence continuation. Use the same neutral questions, accepting "I don't know":

1. What choice mattered most, and what did you give up?
2. What does this result qualify you for?
3. How could this team lose a game it was favored to win?
4. How well did the roster's strengths and weaknesses match your basketball expectations, from 1 to 5? Why?
5. What, if anything, made you want to continue or stop?
6. Was there a point where what happened differed from what you expected? Walk me through it.

Record answers before explaining the intended behavior. Do not score disagreement with the model as a participant error. At the end, clarify any misleading qualification/championship impression and thank them without defending the design.

## Synthesis and Stop

After all six sessions or a blocking failure, summarize completion/help/time, explained tradeoffs, qualification understanding, credibility ratings and voluntary continuation. Show counts with denominators and include incomplete sessions. Separate observed behavior from self-report; retain contradictory examples and differences by experience group or outcome without claiming significance. Do not interpret six people as a reliable win-rate or population-retention estimate.

Produce at most three prioritized issues, each with participant ids, an observation or quote, affected workflow, consequence and one smallest proposed change. One task-blocking failure is sufficient to pause sessions; otherwise use recurring observations to prioritize without inventing numerical release thresholds. It is valid to report no clear balance issue or insufficient evidence. Do not fit a model to participant ratings or automatically start another research cycle. Present the findings for a product decision first.

## Readiness and Handoff

Technical readiness is tracked separately from human results. Preparation checks: production build; desktop and 320px draft-to-result browser journeys; mid-draft and mid-season reload; available rerolls; final-result interpretation; layout and runtime-error inspection. These limited checks do not establish full accessibility, every browser/device, fun or release acceptance. Existing engine regression baseline: 76 passing tests, clean typecheck before this preparation.

The facilitator must recruit real participants and conduct these sessions; an automated agent cannot supply human reactions or consent. No deployment, invitations or participant data collection has been performed during preparation. Obtain each participant's consent before taking notes. Record the tested URL/build and technical readiness outcome below before starting sessions.

- Tested build: `04J5fbvLnRaPr0gRGzkzG`, Next 16.3.5, Node v24.14.0, Windows; source manifest SHA-256 `25c5351d4f9a12efccac4f1d3c266573e08f66d13f6360a7b6d7093a7c45ede4`.
- Local URL: <http://127.0.0.1:4173>. This is accessible only on the facilitator's machine, not a public participant link. Use in-person sessions or a facilitator-driven screen share; a remote participant cannot operate this local URL from their own device. Remote deployment requires a separate decision.
- Technical readiness: **limited smoke checks passed** on 2026-09-15; details below. No production changes were needed.
- Human sessions completed: 0 of 6.

### Technical Evidence

`npm.cmd run build` completed with exit code 0. `npm.cmd run start -- --hostname 127.0.0.1 --port 4173` served the production build and reported ready in 134 ms. Node v24.14.0 is available; Docker was not installed and is not required for this static-data/local-storage app. Browser checks used the integrated Playwright browser, not mocked components. There was no existing browser-test harness in the repository; the existing engine suite remains the 76-test baseline from the preceding task, not a newly run human-study acceptance suite.

| Journey | Evidence | Result |
| --- | --- | --- |
| Desktop, 1440x1000 | Keyboard coach selection, both team/era rerolls, six legal picks with distinct identities, start paused at zero revealed games, mid-draft and mid-season reload preserving exact saves, play/pause, next reveal, skip to final | Pass |
| Narrow screen, 320x800 | Six legal pick dialogs, each within viewport; reduced motion; audio initially off; season starts paused; next reveal, skip, final reload preserving exact run and 82 revealed games | Pass |
| Layout/runtime | No document horizontal overflow in inspected states; final screenshots inspected at both widths; narrow-screen fonts loaded; no page-error events during successful journeys | Pass within sampled states |

Synthetic desktop seed: `e74280e7-e4ff-458a-960c-95086c45d1b5`, 27 wins. Synthetic narrow-screen seed: `55a03349-3383-4074-afd0-019ec838f5e4`, 30 wins. Both confirmed the visible below-60-wins qualification explanation. These first-legal-pick automation runs are **not participants, policy calibration or evidence of difficulty**. No synthetic result belongs in the participant records.

The first narrow-screen check failed because the test queried `[role=dialog]` while the app uses a native `<dialog>` with an implicit role. Repeating the check with `getByRole('dialog')` passed; no app code was changed. Tool-driven browser checks have no process exit code; their assertions returned successfully. Build exit code is 0. Overall: ready for a limited local exploratory study, human evidence awaiting participants, not release sign-off.

Remaining gaps: physical touch devices, comprehensive keyboard/focus and screen-reader checks, other browsers, the qualified-result branch, every overtime path, malformed/legacy save recovery in the browser, and network-failure behavior were not exercised here. Neither screenshot review nor the engine suite proves accessibility or enjoyment. Stop a session if any task-blocking problem occurs. Use a real device check before recruiting mobile participants; the 320px check was desktop-browser viewport emulation, not a physical phone.

The source fingerprint is SHA-256 of compact `JSON.stringify` output containing sorted `[relativePath, fileSHA256]` pairs for the observation record's `testedBuild.sourcePaths`. Hash UTF-8 source bytes, using forward-slash paths. Tests and study notes are excluded. Compare that fingerprint before sessions; a rebuild may change the build id even when source content is identical. If game source/config/data changed, do not pool sessions as one unchanged build.

To restart the tested build locally, use `npm.cmd run start -- --hostname 127.0.0.1 --port 4173` from the workspace. Do not start a second server on an occupied port. If the build output no longer exists, rebuild and update the build record before inviting participants. Keep the production server running throughout a session.

### Facilitator Next Steps

1. Recruit the six players and confirm the experience mix. Suggested invitation: "Would you be willing to try a basketball drafting game for about 40 minutes? I am looking for honest feedback, not a particular skill level. Participation is voluntary, and I will take anonymous notes, with no audio or video recording."
2. Open the tested local URL in a dedicated clean browser profile, confirm the build record, and conduct B01 using the consent and script above. For a first session, use the checked desktop setup.
3. Enter only actual observations using the record templates. Bring back the anonymous B01 notes for interpretation, then continue with the same script unless a blocking problem requires a stop. Do not redesign or coach later participants based on an early preference.
