# Documentation

Start with the [game overview](../README.md), [project status and updates](STATUS.md), [game design](design/GAME_DESIGN.md), and [release gates](release/RELEASE_SCORECARD.md). Dated experiment and playtest records are historical evidence, not current-build acceptance.

## Layout

```text
docs/
  STATUS.md           Current status, dated updates and deployment evidence
  design/             Game rules and roadmap
  progress/           Implementation and verification by phase
  release/            Acceptance gates and release decisions
  playtests/          Human-test protocols and observation templates
  research/
    mid-iq/           Balance reviews, fits, audits and candidate evidence
    phase3/           Early baselines and score calibration
    path-migration.json
```

## Guides

| Area | Document | Purpose |
| --- | --- | --- |
| Status | [Project updates](STATUS.md) | Current status, deployment history, validation and remaining work |
| Design | [Game design](design/GAME_DESIGN.md) | Current rules, compatibility and roadmap |
| Progress | [Phase 7](progress/PHASE7_PROGRESS.md) | Almanac, history, sharing and phase-specific validation |
| Progress | [Phase 6](progress/PHASE6_PROGRESS.md) | Daily rotation, limits and focused validation |
| Progress | [Phase 4/5](progress/PHASE4_PROGRESS.md) | Earlier playback and postseason implementation record |
| Release | [Release scorecard](release/RELEASE_SCORECARD.md) | Binding gates, approved budgets and outstanding measurements |
| Release | [Mid IQ core release](release/MID_IQ_CORE_RELEASE.md) | Historical season-3 release and accepted limitations |
| Playtests | [Baseline protocol](playtests/BASELINE_PLAYTEST.md) | Historical season-3 preparation; register a current build before use |
| Playtests | [Observation template](playtests/BASELINE_PLAYTEST_OBSERVATIONS.json) | No human sessions recorded; never commit participant-level notes |
| Mid IQ research | [Calibration log](research/mid-iq/MID_IQ_ROSTER_CALIBRATION.md) | Chronological research decisions and stopped experiments |
| Mid IQ research | [Roster review](research/mid-iq/MID_IQ_ROSTER_REVIEW.md) | Approved roster expectations and family definitions |
| Mid IQ research | [Balance review](research/mid-iq/MID_IQ_BALANCE_REVIEW.md) | Historical strategy measurements |
| Phase 3 research | [Baseline](research/phase3/PHASE3_BASELINE.md) | Original simulation baseline |
| Phase 3 research | [Review](research/phase3/PHASE3_REVIEW.md) | Policy evaluation and limitations |
| Phase 3 research | [Score calibration](research/phase3/PHASE3_SCORE_CALIBRATION.md) | Initial scoring experiment |
| Phase 3 research | [Score retry](research/phase3/PHASE3_SCORE_RETRY.md) | Second scoring experiment and held-out acceptance |

## Research Compatibility

All 82 existing JSON artifacts were moved without changing their bytes, including failed and superseded results. Research filenames are retained so numbered experiments and their links remain recognizable. These files are not browser runtime inputs, but offline scripts and regression tests still use them.

[The migration manifest](research/path-migration.json) records every old/new document path, frozen JSON checksums, and the exact source revisions caused by updating paths and readers. Historical paths and hashes inside JSON remain original evidence. [The TypeScript reader](../src/engine/research-files.ts) and [Python reader](../scripts/data_pipeline/research_files.py) translate that metadata in memory; source verification compares against the explicitly registered revisions. Actual model outputs, parameters, seeds, targets and acceptance decisions are unchanged.

Replay comparisons account for this metadata translation; frozen-file checks still verify the original bytes. The migration is not a new research run, a refit or release approval. Do not update the revision map just to make a later behavioral change pass.

[Git attributes](../.gitattributes) preserve relocated JSON bytes and pin the revised source files to LF. The source-revision map includes this line-ending normalization. Checksums include line endings; further reformatting or CRLF/LF conversion changes the recorded evidence.

## Adding Documents

Add dated status and deployment updates to [STATUS.md](STATUS.md), including validation scope and remaining limitations. Keep the root README focused on the game and getting started. Put current rules in `design`, implementation records in `progress`, acceptance decisions in `release`, and human-study material in `playtests`. Put new research beside its related reports in `research/mid-iq` or `research/phase3`, using a new filename rather than overwriting frozen evidence. Run commands from the repository root and use the new paths shown in the guides; legacy paths embedded in JSON are resolved by the research readers, not filesystem aliases.

Keep this index for navigation rather than duplicating detailed status reports. Build output, test results, caches and local environments do not belong in this folder.
