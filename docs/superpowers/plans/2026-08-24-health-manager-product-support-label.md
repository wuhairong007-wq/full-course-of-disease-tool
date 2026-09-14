# Health Manager Product-Support Label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent parenthetical medication-support labels from appearing in `AI健康管理师介绍`.

**Architecture:** Add one schema-level generation rule and one patient-aware builder validation. Reuse `combinedMedication` as the authoritative medication-name list so ordinary support wording remains valid.

**Tech Stack:** Node.js ESM, built-in `node:assert`, existing Stage 2 workbook builder.

---

### Task 1: Add a failing builder regression

**Files:**
- Modify: `generating-patient-full-course-data/scripts/test_health_plan_workbook.mjs`

- [ ] Pass an otherwise valid record whose introduction includes `（华法林钠片支持）`.
- [ ] Expect the builder to reject the record with a product-support-label validation error.
- [ ] Run `test_health_plan_workbook.mjs` and confirm the new assertion fails before production code changes.

### Task 2: Enforce the introduction contract

**Files:**
- Modify: `generating-patient-full-course-data/scripts/build_health_plan_workbook.mjs`
- Modify: `generating-patient-full-course-data/references/health-plan-schema.md`

- [ ] Escape each reviewed medication name for regular-expression matching.
- [ ] Reject Chinese- or ASCII-parenthesized exact medication names followed by `支持`.
- [ ] Document the prohibited form and the allowed natural support wording.
- [ ] Re-run the targeted workbook test and confirm it passes.

### Task 3: Validate and synchronize

**Files:**
- Modify: `generating-patient-full-course-data/scripts/validate_skill.mjs`

- [ ] Assert that the Stage 2 schema contains the new prohibition.
- [ ] Run Stage 2 and full skill validations.
- [ ] Synchronize the changed verified files to the active Codex skill installation and rerun its targeted validation.
