# 患者提供处方字段文案 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将患者明细的可见字段从 `处方清单` 改为 `患者提供处方`，并让下游读取兼容旧列名。

**Architecture:** 以 `patient_detail_headers.mjs` 作为唯一表头契约，定义新列名和旧列名别名；所有下游脚本从解析结果取得实际处方列索引，内部 JSON 继续使用 `prescriptionList`。阶段 1 模板和生成器只输出新列名，阶段 2～4 输入同时接受新旧列名。

**Tech Stack:** Node.js ES modules、`@oai/artifact-tool`、Markdown 技能文档、Node `assert/strict` 测试。

---

### Task 1: 锁定表头兼容行为

**Files:**
- Modify: `generating-patient-full-course-data/scripts/test_patient_detail_headers.mjs`
- Modify: `generating-patient-full-course-data/scripts/test_stage1_output_contract.mjs`

- [x] **Step 1: Write failing tests**

  断言当前 16 列表头使用 `患者提供处方`；把旧 16/17/18 列表头复制后替换为 `处方清单`，断言解析成功并返回实际列名；同时断言同时出现新旧列名时失败。

- [x] **Step 2: Run tests to verify failure**

  Run: `node scripts/test_patient_detail_headers.mjs`

  Expected: FAIL because the current parser only recognizes `处方清单` and has no alias metadata.

### Task 2: 实现唯一表头契约并接入下游读取

**Files:**
- Modify: `generating-patient-full-course-data/scripts/patient_detail_headers.mjs`
- Modify: `generating-patient-full-course-data/scripts/extract_health_plan_patients.mjs`
- Modify: `generating-patient-full-course-data/scripts/extract_medication_tracking_patients.mjs`
- Modify: `generating-patient-full-course-data/scripts/extract_adverse_reaction_patients.mjs`
- Modify: `generating-patient-full-course-data/scripts/build_health_plan_workbook.mjs`
- Modify: `generating-patient-full-course-data/scripts/build_medication_tracking_workbooks.mjs`
- Modify: `generating-patient-full-course-data/scripts/build_adverse_reaction_workbook.mjs`

- [x] **Step 1: Implement the minimal alias contract**

  Export `PATIENT_PRESCRIPTION_HEADER = "患者提供处方"` and `LEGACY_PATIENT_PRESCRIPTION_HEADER = "处方清单"`. Recognize either name at the same position, return `prescriptionHeader` with the input’s actual name, and reject a header containing both names.

- [x] **Step 2: Read through `prescriptionHeader`**

  Replace every downstream `indexes["处方清单"]` lookup with `indexes[prescriptionHeader]` from the parser result. Keep internal object keys and JSON shape unchanged.

- [x] **Step 3: Run focused tests**

  Run: `node scripts/test_patient_detail_headers.mjs`

  Expected: PASS.

### Task 3: Switch generated output, templates, docs, and validation

**Files:**
- Modify: `generating-patient-full-course-data/scripts/build_workbook.mjs`
- Modify: `generating-patient-full-course-data/scripts/patient_detail_headers.mjs`
- Modify: `generating-patient-full-course-data/assets/patient-full-course-template.xlsx`
- Modify: `generating-patient-full-course-data/assets/patient-full-course-template.xlsx.inspect.ndjson`
- Modify: `generating-patient-full-course-data/SKILL.md`
- Modify: `generating-patient-full-course-data/references/record-schema.md`
- Modify: `generating-patient-full-course-data/references/health-plan-schema.md`
- Modify: `generating-patient-full-course-data/references/medication-tracking-schema.md`
- Modify: `generating-patient-full-course-data/references/adverse-reaction-schema.md`
- Modify: `generating-patient-full-course-data/references/clinical-rules.md`
- Modify: `generating-patient-full-course-data/scripts/validate_skill.mjs`
- Modify: related tests under `generating-patient-full-course-data/scripts/test_*.mjs`

- [x] **Step 1: Make stage 1 emit the new header**

  Update the canonical 16-column header and template asset to `患者提供处方`; retain old-name assertions only where they verify compatibility or human-readable legacy error wording is intentionally preserved.

- [x] **Step 2: Synchronize dependent documentation and tests**

  Replace patient-detail column contract references with `患者提供处方`, add the explicit old-name compatibility rule, and update expected headers and error assertions.

- [x] **Step 3: Run workbook and package validation**

  Run the focused header/build tests, then `node scripts/validate_skill.mjs` and the stage 2～4 tests that read patient detail workbooks.

### Task 4: Verify the complete contract

- [x] **Step 1: Search for stale hard-coded lookups**

  Run: `rg -n 'indexes\["处方清单"\]|处方清单' generating-patient-full-course-data`.

  Expected: no direct old-name index lookup; remaining old-name mentions are limited to compatibility documentation/tests and user-facing legacy compatibility messages.

- [x] **Step 2: Reopen the updated template**

  Inspect the first row of `patient-full-course-template.xlsx` and confirm the 16 columns contain `患者提供处方` at column M.

- [x] **Step 3: Record verification**

  Passing verification:

  ```bash
  node scripts/test_patient_detail_headers.mjs
  CODEX_NODE_MODULES=/Users/a11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node scripts/test_stage1_output_contract.mjs
  node scripts/validate_skill.mjs
  CODEX_NODE_MODULES=/Users/a11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node scripts/test_health_plan_workbook.mjs
  CODEX_NODE_MODULES=/Users/a11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node scripts/test_health_plan_richness.mjs
  CODEX_NODE_MODULES=/Users/a11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node scripts/test_medication_tracking_workbooks.mjs
  CODEX_NODE_MODULES=/Users/a11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node scripts/test_adverse_reaction_workbook.mjs
  CODEX_NODE_MODULES=/Users/a11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node scripts/test_adverse_reaction_light_selection.mjs
  node scripts/test_adverse_reaction_validation.mjs
  node scripts/test_prescription_content_validator.mjs
  node scripts/test_fictional_test_mode.mjs
  CODEX_NODE_MODULES=/Users/a11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node scripts/test_fictional_workbook.mjs
  ```

  An additional temporary compatibility fixture passed all three downstream extractors with the legacy `处方清单` header. Do not commit or push unrelated existing changes.
