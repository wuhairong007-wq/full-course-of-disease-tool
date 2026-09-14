# Health Plan Numeric Surgery Placeholder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent numeric-only surgery placeholders such as `29` from appearing in Stage 2 health-management-plan workbooks.

**Architecture:** Add one shared normalizer used at both Stage 2 boundaries. The extractor cleans model input, while the builder independently cleans validation context so malformed generated records are rejected.

**Tech Stack:** Node.js ESM, `@oai/artifact-tool`, built-in `node:assert` tests.

---

### Task 1: Add the failing regression case

**Files:**
- Modify: `generating-patient-full-course-data/scripts/test_health_plan_workbook.mjs`

- [ ] Change the non-surgical test patient to use `手术名称=29` while keeping the expected extracted surgery name empty.
- [ ] Assert that final treatment and pharmacology cells do not contain a numeric-only surgery item.
- [ ] Run the targeted test and confirm it fails because the extractor currently returns `29`.

### Task 2: Normalize Stage 2 surgery names

**Files:**
- Create: `generating-patient-full-course-data/scripts/health_plan_patient_normalizer.mjs`
- Modify: `generating-patient-full-course-data/scripts/extract_health_plan_patients.mjs`
- Modify: `generating-patient-full-course-data/scripts/build_health_plan_workbook.mjs`

- [ ] Export `normalizeReviewedSurgeryName(value)` that trims input and returns `""` for `/^\d+$/`.
- [ ] Use the helper in the extractor and builder.
- [ ] Run the targeted test and confirm it passes.

### Task 3: Document and validate the rule

**Files:**
- Modify: `generating-patient-full-course-data/references/health-plan-schema.md`
- Modify: `generating-patient-full-course-data/scripts/validate_skill.mjs`

- [ ] State that numeric-only surgery values are placeholders and must be treated as empty.
- [ ] Require the shared normalizer in package validation and assert the documented rule exists.
- [ ] Run all skill tests and package validation.

### Task 4: Verify the real defect

**Files:**
- No production file changes.

- [ ] Extract patients from the reported 2,500-row workbook and verify all 2,200 numeric surgery values normalize to empty.
- [ ] Confirm the repository diff contains only scoped Stage 2 changes and documentation.
