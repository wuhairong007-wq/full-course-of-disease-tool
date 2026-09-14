# Stage 1 Cohort Medication Diversity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Require a safe cohort-level diversity review so same-disease Stage 1 records use stable equivalent alternatives when clinically eligible instead of defaulting the entire group to identical medication and prescription data.

**Architecture:** Strengthen the generation contract in `SKILL.md` and the two Stage 1 reference documents, then enforce those instructions through package-validation assertions. Keep the existing deterministic selector unchanged and synchronize the verified active skill into the GitHub repository copy.

**Tech Stack:** Markdown skill instructions, Node.js ESM, built-in `node:assert`, Git.

---

### Task 1: Add failing package assertions

**Files:**
- Modify: `/Users/a11/Sites/Java/JKZL/skills/generating-patient-full-course-data/scripts/validate_skill.mjs`

- [ ] Add assertions requiring `same-disease cohort`, `multiple eligible equivalents`, `stable selector`, and an explicit prohibition against cosmetic variation in the Stage 1 skill and references.
- [ ] Run `scripts/validate_skill.mjs` and confirm it fails because the cohort contract is absent.

### Task 2: Add cohort diversity guidance

**Files:**
- Modify: `/Users/a11/Sites/Java/JKZL/skills/generating-patient-full-course-data/SKILL.md`
- Modify: `/Users/a11/Sites/Java/JKZL/skills/generating-patient-full-course-data/references/clinical-rules.md`
- Modify: `/Users/a11/Sites/Java/JKZL/skills/generating-patient-full-course-data/references/record-schema.md`

- [ ] Add a post-draft disease-group review to Stage 1.
- [ ] Require stable equivalent selection for every eligible patient when multiple safe candidates exist.
- [ ] Require complete prescription regeneration after an equivalent substitution.
- [ ] Allow identical regimens when only one safe candidate remains.
- [ ] Prohibit changing treatment roles, medication counts, doses, or durations solely for diversity.
- [ ] Run package validation and confirm it passes.

### Task 3: Bump and synchronize version

**Files:**
- Modify: `/Users/a11/Sites/Java/JKZL/skills/generating-patient-full-course-data/SKILL.md`
- Synchronize: `/Users/a11/Sites/Java/JKZL/skills/full-course-of-disease-tool/generating-patient-full-course-data`

- [ ] Change `metadata.version` from `1.0.0` to `1.1.0`.
- [ ] Apply the same verified files to the repository copy.
- [ ] Verify `diff -qr` reports no differences between active and repository skill directories.

### Task 4: Verify and publish

**Files:**
- Verify all modified skill files.

- [ ] Run package validation in both skill copies.
- [ ] Run `scripts/test_equivalent_medication_selector.mjs`.
- [ ] Run `git diff --check` and inspect the Git scope.
- [ ] Commit only runtime skill files and push `main`; leave unrelated untracked design and plan documents unstaged.
