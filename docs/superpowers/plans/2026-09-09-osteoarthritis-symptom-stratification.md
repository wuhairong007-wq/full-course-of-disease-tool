# Osteoarthritis Symptom Stratification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce safe, deterministic 1-3 medication osteoarthritis regimens from user-authorized simulated pain and inflammation strata.

**Architecture:** A small selector module owns stratification and candidate-owned prescription entries. The generation script consumes its output, while the existing workbook builder retains responsibility for source alignment and clinical safety validation.

**Tech Stack:** Node.js ESM, node:assert/strict, bundled Artifact Tool.

---

### Task 1: Define the selector contract

**Files:**
- Create: `generating-patient-full-course-data/scripts/osteoarthritis_medication_selector.mjs`
- Create: `generating-patient-full-course-data/scripts/test_osteoarthritis_medication_selector.mjs`

- [ ] **Step 1: Write the failing test**

```js
const severe = selectOsteoarthritisMedication({ userid: "U001", disease: "原发性膝骨关节炎", allergyHistory: "无", productName: "硫酸氨基葡萄糖胶囊" });
assert.deepEqual(severe.medications, ["硫酸氨基葡萄糖胶囊", "双氯芬酸二乙胺乳胶剂", "对乙酰氨基酚片"]);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node generating-patient-full-course-data/scripts/test_osteoarthritis_medication_selector.mjs`
Expected: failure because the selector module does not exist.

- [ ] **Step 3: Implement the selector**

```js
export function selectOsteoarthritisMedication(patient) {
  // Stable key chooses mild, moderate, or severe; return medications and matching entries.
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node generating-patient-full-course-data/scripts/test_osteoarthritis_medication_selector.mjs`
Expected: `status: passed`.

### Task 2: Document authorized simulated symptoms

**Files:**
- Modify: `generating-patient-full-course-data/SKILL.md`
- Modify: `generating-patient-full-course-data/references/clinical-rules.md`

- [ ] **Step 1: Add the opt-in rule**

Require explicit user authorization before simulated pain/inflammation strata can add a symptom-supportive role. State that the simulated facts remain internal and that allergy checks and complete prescriptions still apply.

- [ ] **Step 2: Validate existing skill tests**

Run: `node generating-patient-full-course-data/scripts/validate_skill.mjs`
Expected: `status: passed`.

### Task 3: Regenerate and verify the workbook

**Files:**
- Create: `outputs/patient-full-course/患者全病程审核数据 (4)/患者全病程审核数据 (4)_患者全病程数据.xlsx`

- [ ] **Step 1: Generate records with the selector**

Run the bundled builder with the extracted source records and selector-generated JSON.

- [ ] **Step 2: Validate the workbook**

Run the stage-1 workbook tests and inspect regimen counts. Render the first, middle, and final records to confirm readable output.
