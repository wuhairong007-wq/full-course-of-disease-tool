# Pharmacology-Only Implementation Plan

**Goal:** Restrict stage-2 `AI药理科普` to medication pharmacology.

**Architecture:** Keep the existing content validator as the single paragraph validation boundary and remove the builder's duplicate execution/safety requirements. Update the schema and skill verification instructions together.

**Tech Stack:** Node.js assertions, existing artifact-tool workbook tests, Markdown.

## Tasks

- [x] Replace the content-validator test fixture with mechanism-only text; cover concise text, missing mechanism, prescription parameters, administration instructions, unrelated content and procedure paragraphs. Observe the old validator reject valid pharmacology.
- [x] Update the paragraph and content validators; remove prescription token extraction and duplicate builder execution/safety checks.
- [x] Update workbook fixtures and rejection cases to verify medication-only pharmacology for device and medication patients while preserving treatment prescriptions.
- [x] Update `SKILL.md`, `references/health-plan-schema.md`, package checks and version.
- [x] Run stage-2 tests and package validation; inspect the diff.
- [x] Synchronize changed package files to the installed skill, compare them, and run installed validation.

## Verification

The mechanism-only fixture first failed against the old patient-context requirement. After the change, content validation, medical-record validation, workbook integration (13 columns, device and medication patients, real and simulated summaries, manufacturer scope), richness rejection and 16/17/18-column header compatibility passed. The 84-file package check, Skill Creator validation and `git diff --check` passed.

Seven changed package files were synchronized to the installed skill after confirming each installed original matched the repository baseline. Byte comparisons passed; unrelated installed changes were preserved. Installed content and package validation passed. Version: `1.2.32`. Publication is tracked by the repository commit history.
