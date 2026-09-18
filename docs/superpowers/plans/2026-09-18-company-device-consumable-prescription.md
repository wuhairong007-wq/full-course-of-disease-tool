# 公司器械耗材与处方特殊处理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将患者明细升级为 18 列并实现山东利赛、湖南昕敷佳两家公司的器械耗材与处方特殊处理，同时保持后续阶段对旧 17 列文件的兼容。

**Architecture:** 在阶段 1脚本中增加集中式公司器械策略与耗材段校验，使用七键生成记录驱动 18 列导出；阶段 2～4 使用兼容性表头解析器接受 17/18 列，但不扩展各自最终输出模板。模拟模式复用同一策略，避免真实和模拟分叉。

**Tech Stack:** Node.js ESM、`@oai/artifact-tool`、Node `assert/strict` 测试、Markdown 契约文件。

---

### Task 1: Add failing stage-1 company-policy tests

**Files:**
- Modify: `generating-patient-full-course-data/scripts/test_build_workbook.mjs`
- Modify: `generating-patient-full-course-data/scripts/test_stage1_output_contract.mjs`

- [ ] **Step 1: Add device fixtures for both companies**

Extend the source fixture with one device patient for `山东利赛医药有限公司` and one for `湖南昕敷佳生物科技有限公司`. Use distinct product names and valid surgeries. Update test records to include the ordered `consumableName` key.

- [ ] **Step 2: Add red assertions for the 18-column contract**

Assert the exact header order:

```js
const expectedHeaders = [
  ...sourceHeaders.slice(0, 11),
  "联合用药", "处方清单", "手术名称", "耗材名称", "全病程方案名称", "AI状态", "确认状态",
];
```

Assert both device rows write `耗材名称=产品名称`, and assert the Shandong prescription omits the product while the Hunan prescription ends with exactly one `耗材名称：产品名称` segment.

- [ ] **Step 3: Add red assertions for invalid Hunan records**

Add cases for missing Hunan consumable segment, wrong product name, duplicate consumable segments, and a segment placed before a medication entry. Each must fail with a company-policy validation error.

- [ ] **Step 4: Run the focused tests and confirm failure**

Run:

```bash
node scripts/test_build_workbook.mjs
node scripts/test_stage1_output_contract.mjs
```

Expected: failures caused by the current 17-column schema, six-key record contract, and missing Hunan device policy.

### Task 2: Implement shared company device policy and stage-1 export

**Files:**
- Modify: `generating-patient-full-course-data/scripts/clinical_medication_validator.mjs`
- Modify: `generating-patient-full-course-data/scripts/build_workbook.mjs`
- Modify: `generating-patient-full-course-data/scripts/fictional_test_mode.mjs`
- Modify: `generating-patient-full-course-data/references/record-schema.md`
- Modify: `generating-patient-full-course-data/references/clinical-rules.md`

- [ ] **Step 1: Add a policy helper with explicit company constants**

Export a helper that returns `{ consumableRequired, prescriptionProductMode, consumableSegment }` for `(company, productType, productName)`. Support `omit`, `include`, and `none`; only device products for the two named companies get `consumableRequired=true`.

- [ ] **Step 2: Upgrade the stage-1 record key contract**

Change the ordered keys to `userid`, `allergyHistory`, `combinedMedication`, `prescriptionList`, `surgeryName`, `consumableName`, `coursePlanName`. Require `consumableName` to equal the source product only for the two target-company device cases and to be empty for non-device or other-company cases.

- [ ] **Step 3: Make prescription mapping understand the optional device segment**

Validate the first N ` + ` segments against the N medications and drug specifications. Permit one final `耗材名称：产品名称` segment only when the Hunan device policy requires it; reject missing, duplicated, misplaced, or mismatched segments. For Shandong device records, remove product-bearing segments and reject any remaining exact product name.

- [ ] **Step 4: Update the output template contract to 18 columns**

Insert `耗材名称` after `手术名称`, update template header checks, output row construction, workbook table range, preview range, field count, and style-copy ranges to derive from the 18-column header array. Keep `combinedMedication` limited to drugs.

- [ ] **Step 5: Reuse the same policy in fictional mode**

Add `consumableName` to fictional records and generate the Hunan/ Shandong prescription behavior through the shared policy. Keep fictional review replay deterministic and preserve the filename-only simulation marker.

- [ ] **Step 6: Run the focused tests and confirm green**

Run:

```bash
node scripts/test_build_workbook.mjs
node scripts/test_stage1_output_contract.mjs
node scripts/test_fictional_workbook.mjs
```

Expected: all focused stage-1 tests pass, including existing medication and allergy cases.

### Task 3: Add 17/18-column compatibility for stage 2

**Files:**
- Modify: `generating-patient-full-course-data/scripts/extract_health_plan_patients.mjs`
- Modify: `generating-patient-full-course-data/scripts/build_health_plan_workbook.mjs`
- Modify: `generating-patient-full-course-data/scripts/test_health_plan_workbook.mjs`
- Modify: `generating-patient-full-course-data/scripts/test_health_plan_richness.mjs`
- Modify: `generating-patient-full-course-data/references/health-plan-schema.md`

- [ ] **Step 1: Add a compatibility header parser**

Accept the legacy 17-column sequence or the new sequence with `耗材名称` after `手术名称`; normalize legacy input to an empty `consumableName`.

- [ ] **Step 2: Thread consumable context into the internal patient object**

Read `耗材名称` when present, but keep the existing health-plan output template at 13 columns and keep treatment-plan allowed items limited to reviewed medications plus `surgeryName`.

- [ ] **Step 3: Add tests for both input shapes**

Run the same valid records against 17-column and 18-column source workbooks. Assert the 18-column path retains `consumableName` internally and never creates an extra medication or treatment item.

- [ ] **Step 4: Run stage-2 tests**

```bash
node scripts/test_health_plan_workbook.mjs
node scripts/test_health_plan_richness.mjs
```

Expected: both legacy and new patient-detail inputs pass.

### Task 4: Add 17/18-column compatibility for stages 3 and 4

**Files:**
- Modify: `generating-patient-full-course-data/scripts/extract_medication_tracking_patients.mjs`
- Modify: `generating-patient-full-course-data/scripts/build_medication_tracking_workbooks.mjs`
- Modify: `generating-patient-full-course-data/scripts/extract_adverse_reaction_patients.mjs`
- Modify: `generating-patient-full-course-data/scripts/build_adverse_reaction_workbook.mjs`
- Modify: `generating-patient-full-course-data/scripts/test_medication_tracking_workbooks.mjs`
- Modify: `generating-patient-full-course-data/scripts/test_adverse_reaction_workbook.mjs`
- Modify: `generating-patient-full-course-data/scripts/test_adverse_reaction_light_selection.mjs`
- Modify: `generating-patient-full-course-data/references/medication-tracking-schema.md`
- Modify: `generating-patient-full-course-data/references/adverse-reaction-schema.md`

- [ ] **Step 1: Accept both patient-detail header sequences**

Use the same 17/18-column compatibility helper in each extractor and builder. For 18-column input, read `consumableName`; for 17-column input, use an empty string.

- [ ] **Step 2: Preserve medication-only behavior**

Keep medication item counts, prescription inclusion checks, adverse-reaction eligibility, and final output templates unchanged. Add assertions that a device consumable is not emitted as a medication item or named intervention.

- [ ] **Step 3: Add legacy and new-shape regression fixtures**

Run each stage against a legacy 17-column workbook and a new 18-column workbook containing both target-company device rows. Assert the same medication rows and adverse-reaction selection, with no accidental device medication row.

- [ ] **Step 4: Run stage-3 and stage-4 tests**

```bash
node scripts/test_medication_tracking_workbooks.mjs
node scripts/test_adverse_reaction_workbook.mjs
node scripts/test_adverse_reaction_light_selection.mjs
```

Expected: all existing timing, medication whitelist, severity, and output-format checks remain green.

### Task 5: Update skill contracts, metadata, and validation tests

**Files:**
- Modify: `generating-patient-full-course-data/SKILL.md`
- Modify: `generating-patient-full-course-data/agents/openai.yaml`
- Modify: `generating-patient-full-course-data/scripts/validate_skill.mjs`
- Modify: `generating-patient-full-course-data/scripts/test_extract_patients.mjs`
- Modify: `generating-patient-full-course-data/scripts/test_fictional_test_mode.mjs`
- Modify: `generating-patient-full-course-data/references/fictional-test-mode.md`

- [ ] **Step 1: Document exact routing and company behavior**

Update the stage-1 contract to say 18 columns/seven keys, the two device-company policies, Hunan’s final consumable segment, and downstream 17/18-column compatibility. Update stop conditions and verification wording accordingly.

- [ ] **Step 2: Bump metadata to 1.2.11**

Update `SKILL.md` and `agents/openai.yaml` prompt text if it mentions the old fixed 17-column contract. Keep trigger phrases unchanged.

- [ ] **Step 3: Strengthen package validation**

Add checks for `湖南昕敷佳生物科技有限公司`, `耗材名称`, the 18-column header, the optional Hunan segment, and compatibility wording. Update old assertions that require fixed 17 columns only where they describe stage-1 output; retain 17-column legacy acceptance checks.

- [ ] **Step 4: Run package validation**

```bash
node scripts/validate_skill.mjs
```

Expected: package completeness and contract assertions pass.

### Task 6: Full verification and installation sync

**Files:**
- Modify: `generating-patient-full-course-data/` files touched by Tasks 1–5
- Sync: `/Users/a11/.codex/skills/generating-patient-full-course-data/` after repository verification

- [ ] **Step 1: Run all Node tests from the skill directory**

```bash
for test in scripts/test_*.mjs; do node "$test"; done
```

Expected: every test exits 0; any test requiring the Codex runtime uses the already detected `CODEX_NODE_MODULES` path.

- [ ] **Step 2: Inspect the final diff and schema consistency**

Verify there are no remaining stage-1 assertions saying the output is fixed 17 columns, no six-key record assertions, no hard-coded `A:Q` stage-1 ranges, and no downstream parser that rejects a valid 18-column stage-1 workbook.

- [ ] **Step 3: Re-run package validation and capture output**

```bash
node scripts/validate_skill.mjs
```

- [ ] **Step 4: Sync the installed skill**

Copy only the canonical skill package files into `/Users/a11/.codex/skills/generating-patient-full-course-data/`, preserving generated outputs and unrelated installed files. Confirm the installed `SKILL.md` reports version `1.2.11`.

- [ ] **Step 5: Report verification evidence**

Summarize the two company behaviors, the 18-column header, legacy compatibility, test commands, and installed version. Do not claim completion until all required tests and the installed metadata check pass.
