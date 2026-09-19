# Health Plan Device Product Exclusion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the manager-introduction and treatment-plan product-name exclusions only to device patients while preserving medication coverage validation.

**Architecture:** Derive a device flag from the reviewed patient-detail fields already available to stage 2. Use that flag around the `AI健康管理师介绍` and `治疗方案梳理` product-name validations, leaving all other content checks intact.

**Tech Stack:** Node.js ES modules, `@oai/artifact-tool`, `node:assert`, Excel templates.

---

### Task 1: Add regression coverage

**Files:**
- Modify: `generating-patient-full-course-data/scripts/test_health_plan_workbook.mjs`

- [x] Add a medication patient whose treatment plan contains the explicit product name and assert export succeeds.
- [x] Add a device patient whose treatment plan contains the explicit product name and assert export fails with the device-only exclusion error.
- [x] Run `node scripts/test_health_plan_workbook.mjs` and verify the medication case fails under the current unconditional exclusion.

### Task 2: Implement device-only validation

**Files:**
- Modify: `generating-patient-full-course-data/scripts/build_health_plan_workbook.mjs`
- Modify: `generating-patient-full-course-data/references/health-plan-schema.md`
- Modify: `generating-patient-full-course-data/SKILL.md`
- Modify: `generating-patient-full-course-data/agents/openai.yaml`

- [x] Derive `isDevice` from non-empty `耗材名称`, falling back to non-empty `手术名称` for legacy input.
- [x] Gate the treatment-plan product-name rejection on `isDevice`.
- [x] Update stage-2 instructions and increment the skill patch version.
- [x] Run the health-plan workbook test and verify it passes.

### Task 3: Validate and synchronize

**Files:**
- Synchronize: `generating-patient-full-course-data/` to `/Users/a11/.codex/skills/generating-patient-full-course-data/`

- [x] Run `node scripts/validate_skill.mjs`.
- [x] Run `rsync -a --delete` to synchronize the installed skill.
- [x] Run `rsync -ain --delete` and verify there are no remaining differences.
