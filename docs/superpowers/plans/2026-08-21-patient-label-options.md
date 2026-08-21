# Patient Label Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow `患者标签` values `无 / 轻度 / 中度 / 高度`, preserve tracking behavior, and include light-level patients in adverse-reaction lists while excluding `无`.

**Architecture:** Keep label validation local to each stage. Stage 3 accepts all four values and preserves the existing intervention predicate (`中度/高度` only). Stage 4 uses a shared eligible-level set concept in extractor and builder so both select `轻度/中度/高度` in source order and map intervention deterministically.

**Tech Stack:** Node.js ES modules, `@oai/artifact-tool`, bundled Excel templates, `node:assert/strict` regression tests.

---

### Task 1: Lock Tracking Label Compatibility

**Files:**
- Modify: `generating-patient-full-course-data/scripts/test_medication_tracking_workbooks.mjs`
- Modify: `generating-patient-full-course-data/scripts/extract_medication_tracking_patients.mjs`
- Modify: `generating-patient-full-course-data/scripts/build_medication_tracking_workbooks.mjs`
- Modify: `generating-patient-full-course-data/references/medication-tracking-schema.md`

- [ ] **Step 1: Write the failing test**

Change one tracking fixture to `患者标签=无`, then assert extraction succeeds and the generated `是否触发人工干预` value is `否` while reminder calculations and medication rows remain unchanged.

```js
assert.equal(extracted[1].adverseReactionLevel, "无");
assert.deepEqual(trackingRows.slice(1).map((row) => row[12]), ["是", "否"]);
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
CODEX_NODE_MODULES=<bundled-node-modules> <bundled-node> generating-patient-full-course-data/scripts/test_medication_tracking_workbooks.mjs
```

Expected: FAIL with `不良反应分层必须为轻度、中度或高度`.

- [ ] **Step 3: Implement four-value validation**

Update both Stage 3 validators to accept all four values without changing the existing intervention expression:

```js
if (!["无", "轻度", "中度", "高度"].includes(adverseReactionLevel)) {
  throw new Error(`${userid}的不良反应分层必须为无、轻度、中度或高度`);
}

manualIntervention: ["中度", "高度"].includes(patient.adverseReactionLevel) ? "是" : "否";
```

Update the Stage 3 schema to state `无/轻度 → 否` and confirm no other formulas change.

- [ ] **Step 4: Run the tracking test**

Run the command from Step 2.

Expected: PASS with two patients, unchanged reminder and medication output structure.

### Task 2: Expand Adverse-Reaction Eligibility

**Files:**
- Modify: `generating-patient-full-course-data/scripts/test_adverse_reaction_workbook.mjs`
- Modify: `generating-patient-full-course-data/scripts/extract_adverse_reaction_patients.mjs`
- Modify: `generating-patient-full-course-data/scripts/build_adverse_reaction_workbook.mjs`
- Modify: `generating-patient-full-course-data/references/adverse-reaction-schema.md`

- [ ] **Step 1: Write the failing selection test**

Add a `患者标签=无` row before the existing eligible rows. Request three records and assert the selected levels and intervention mapping are:

```js
assert.deepEqual(extracted.map(({ adverseReactionLevel }) => adverseReactionLevel), ["中度", "轻度", "高度"]);
assert.deepEqual(outputRows.slice(1).map((row) => row[8]), ["否", "否", "是"]);
```

Provide a conservative light-level narrative record so the builder receives exactly three records.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
CODEX_NODE_MODULES=<bundled-node-modules> <bundled-node> generating-patient-full-course-data/scripts/test_adverse_reaction_workbook.mjs
```

Expected: FAIL because `无` is rejected or `轻度` is excluded by current code.

- [ ] **Step 3: Implement Stage 4 eligibility and mapping**

Use the same allowed and eligible sets in extractor and builder:

```js
const allowedLevels = new Set(["无", "轻度", "中度", "高度"]);
const eligibleLevels = new Set(["轻度", "中度", "高度"]);
```

Validate against `allowedLevels`, filter with `eligibleLevels`, copy the level unchanged, and preserve:

```js
patient.adverseReactionLevel === "高度" ? "是" : "否";
```

Update insufficient-count messages to refer to `轻度、中度或高度患者`.

- [ ] **Step 4: Run adverse-reaction tests**

Run:

```bash
CODEX_NODE_MODULES=<bundled-node-modules> <bundled-node> generating-patient-full-course-data/scripts/test_adverse_reaction_workbook.mjs
CODEX_NODE_MODULES=<bundled-node-modules> <bundled-node> generating-patient-full-course-data/scripts/test_adverse_reaction_validation.mjs
```

Expected: both PASS; output levels are copied exactly and intervention values are `否/否/是`.

### Task 3: Align Skill Contract and Structural Validation

**Files:**
- Modify: `generating-patient-full-course-data/SKILL.md`
- Modify: `generating-patient-full-course-data/scripts/validate_skill.mjs`

- [ ] **Step 1: Update contract assertions first**

Change structural assertions to require the four-value input contract and three eligible adverse-reaction levels:

```js
assert.match(medicationSchema, /`无`.*`轻度`.*`中度`.*`高度`/s);
assert.match(adverseSchema, /`轻度`, `中度`, or `高度`/);
assert.match(adverseSchema, /`高度` → `是`; `轻度` and `中度` → `否`/);
```

- [ ] **Step 2: Run structural validation to verify it fails**

Run:

```bash
<bundled-node> generating-patient-full-course-data/scripts/validate_skill.mjs
```

Expected: FAIL until the skill and schemas describe the new contract.

- [ ] **Step 3: Update skill stop conditions**

Document:

```text
Stage 3 accepts 无 | 轻度 | 中度 | 高度 and keeps 中度/高度 → 是, 无/轻度 → 否.
Stage 4 selects 轻度/中度/高度, excludes 无, and maps only 高度 to 是.
```

- [ ] **Step 4: Run structural validation**

Run the command from Step 2.

Expected: PASS with all required files and assertions.

### Task 4: Verify, Sync, and Commit

**Files:**
- Sync repository files into: `/Users/a11/.codex/skills/generating-patient-full-course-data/`

- [ ] **Step 1: Run the full repository test suite**

Run every `scripts/test_*.mjs` plus `scripts/validate_skill.mjs` with bundled Node and `CODEX_NODE_MODULES`.

Expected: all scripts exit 0; workbook tests report passed rows and columns.

- [ ] **Step 2: Sync the verified skill**

Copy only changed skill files from the repository skill directory to the installed skill directory, preserving relative paths.

- [ ] **Step 3: Verify installed skill**

Run installed `validate_skill.mjs`, tracking workbook test, and adverse-reaction workbook test.

Expected: all exit 0 using the installed skill paths.

- [ ] **Step 4: Commit implementation**

```bash
git add generating-patient-full-course-data
git commit -m "Expand patient label handling"
```

- [ ] **Step 5: Confirm clean repository state**

Run `git status --short` and `git log -1 --oneline`.

Expected: no uncommitted skill changes and the latest commit is the implementation commit.
