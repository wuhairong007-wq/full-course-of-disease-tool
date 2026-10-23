# Outpatient Summary Implementation Plan

**Goal:** Generate clinically consistent typical consultation summaries without simulation disclaimers in cells.

**Architecture:** Reuse `health_plan_content_validator.mjs` for field-scoped patient/mode validation. Route the stage-2 skill to explicit simulated export while retaining the builder's existing real-mode default and all unrelated treatment checks.

**Tech Stack:** Node.js assertions, existing artifact-tool workbook builder, Markdown and YAML.

## Tasks

- [x] Add `scripts/test_health_plan_medical_record.mjs` covering a valid simulated hypertension summary, normal/missing BP rejection, unsupported prospective placeholders, missing complaint duration, missing findings, unrelated disposition, postoperative-phase contradiction, banned prose and real-mode compatibility. Run with Node and observe the missing-validation failure.
- [x] Extend `validateMedicalRecordContent(text, userid, { patient, mode })`; move the builder's existing six-label/real-prompt checks into its contextual path. In fictional mode require a disease-bearing disposition and actual-style complaint/findings; validate BP and postoperative-phase examples.
- [x] Add builder `--mode real|fictional-test`, filename guard, and patient/mode context. Add integration cases using the existing workbook fixtures; retain real-mode tests unchanged.
- [x] Update `SKILL.md`, `references/health-plan-schema.md`, `agents/openai.yaml`, `README.md` and package checks for the new field-scoped contract and version 1.2.28. Keep mode selection, filename marker and factual boundaries consistent across these files.
- [x] Run `node scripts/test_health_plan_medical_record.mjs`, `node scripts/test_health_plan_content_validator.mjs`, `node scripts/test_health_plan_workbook.mjs`, `node scripts/test_health_plan_richness.mjs`, `node scripts/validate_skill.mjs` and `git diff --check`.
- [x] Sync the canonical package to `/Users/a11/.codex/skills/generating-patient-full-course-data`, verify checksum parity and installed package validation, and report the resulting local state without claiming a GitHub push.

## Verification Results

The new medical-record suite first failed with `Missing expected exception` for the normal-BP hypertension case, then passed after implementation. Content validation, workbook integration (real and simulated summaries), richness rejection, 16/17/18-column header compatibility, manufacturer-medication workflow and package validation passed. Skill Creator's `quick_validate.py` passed. Installed-file checksum comparison produced no differences, and the installed medical-record suite and package validation passed. `git diff --check` passed. No patient workbooks were added to the repository; test workbooks remained in temporary directories. This change is not committed or pushed.
