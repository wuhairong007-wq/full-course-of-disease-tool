---
name: generating-patient-full-course-data
description: Use when a user provides an Excel file and asks to generate 患者明细、患者全病程数据、出院后个性化医疗记录、联合用药、处方清单、器械匹配手术名称、全病程方案、健康管理方案、跟踪提醒、用药清单或不良反应清单, including “生成患者明细 依据文件：Excel路径”, “生成健康管理方案 依据文件：Excel路径”, “生成跟踪提醒和用药清单 依据文件：Excel路径 服务周期 YYYY-MM-DD 至 YYYY-MM-DD”, and “生成不良反应清单 依据文件：Excel路径 数量：N”.
---

# Generating Patient Full-Course Data

Generate a template-matched workbook from one source `.xlsx` path. Preserve every source patient and use conservative clinical reasoning.

## Required Resources

- For stage 1, read `references/clinical-rules.md`, `references/drug-specification-rules.md`, and `references/record-schema.md` completely.
- For stage 2, read `references/health-plan-schema.md` completely.
- For stage 3, read `references/medication-tracking-schema.md` completely.
- For stage 4, read `references/adverse-reaction-schema.md` completely.
- Use the matching bundled template in `assets/`; do not invent another layout.
- Use the bundled extractor and builder scripts; do not rewrite their workbook logic.
- **REQUIRED SUB-SKILL:** Use `spreadsheets:Spreadsheets` for dependency loading and visual verification.

## Route the Request

- `生成患者明细 依据文件：<source.xlsx>` invokes stage 1.
- `生成健康管理方案 依据文件：<source.xlsx>` invokes stage 2.
- `生成跟踪提醒和用药清单 依据文件：<source.xlsx> 服务周期 YYYY-MM-DD 至 YYYY-MM-DD` invokes stage 3.
- `生成不良反应清单 依据文件：<source.xlsx> 数量：N` invokes stage 4.
- An explicit trigger always wins. If the user supplies only a path, the exact reviewed 17-column contract invokes stage 2; stage 3 requires its explicit trigger and service period; otherwise use stage 1.
- Do not ask for fields already present in the workbook.

## Shared Setup

1. Call `load_workspace_dependencies`.
2. Create a temporary work directory.
3. Set `CODEX_NODE_MODULES` to the returned Node packages path for every bundled Node command.
4. Never overwrite the source workbook.
5. Never emit language that describes absent input or references the source file, including `源文件未提供`, `未提供`, `未获取`, `暂无资料`, or equivalent placeholders. Omit an unsupported fact or its label instead; never fabricate content to fill the omission.

## Stage 1 — Patient Full-Course Details

1. Run:

   ```bash
   <bundled-node> scripts/extract_patients.mjs --input <source.xlsx> --output <temp>/patients.json
   ```

2. For each patient, build treatment roles in this order: the supplied medicinal product; etiologic, first-line, maintenance, or mandatory postoperative therapy; then each evidence-supported symptom-supportive medication. Decide whether a role is needed only from disease, procedure, age, sex, allergy history, product, and reviewed surgery. Continue the full assessment until 3～5 distinct, directly indicated medications are selected. Within that range, let clinical need determine the count; do not default every patient to the same number, and never add an unrelated or contraindicated drug merely to reach three.
3. When one treatment role has multiple clinically equivalent candidates, first remove candidates that fail indication, treatment-line, route, age, allergy, contraindication, or interaction checks. Call `scripts/equivalent_medication_selector.mjs` with the eligible candidate objects and the stable key `userid + disease + therapy role`. The userid selects only within an already eligible equivalent group; it must never create an indication or change the number of treatment roles. Keep exactly one candidate for the role. A one-candidate group stays unchanged.
4. Finalize and deduplicate `combinedMedication`, then generate exactly one complete prescription entry for each selected medication in the same order. Treat medication name, dosage form, specification, single dose, route, frequency, timing, duration, and warnings as one candidate-owned set. Validate each set against `references/drug-specification-rules.md`; never guess a strength, convert an unsupported unit, or retain parameters from a discarded alternative. Generate exactly one six-field record according to all stage-1 references and write `<temp>/records.json`.
5. Set the output to the source directory unless the user specifies another location. Use `<source-stem>_患者全病程数据.xlsx`; if the source stem already contains `患者明细`, prefer `患者全病程数据_生成.xlsx`. If the source directory is not writable, use `outputs/patient-full-course/<source-stem>/`.
6. Run:

   ```bash
   <bundled-node> scripts/build_workbook.mjs \
     --input <source.xlsx> \
     --records <temp>/records.json \
     --template assets/patient-full-course-template.xlsx \
     --output <output.xlsx> \
     --preview <temp>/preview.png
   ```

7. Verify exact headers, source-order `userid`, one row per patient, 3～5 medications per patient, populated generated columns, no prohibited missing-input placeholders, drug-specific specification units, dosage-form/package-unit compatibility, one table object, no formula errors, and readable first/middle/last previews. For repeated runs, verify that the same patient and eligible candidate groups produce the same medication choices; across patients, equivalent alternatives may differ without changing treatment roles or medication counts.

## Stage 2 — Health Management Plan

1. Run:

   ```bash
   <bundled-node> scripts/extract_health_plan_patients.mjs \
     --input <source.xlsx> \
     --output <temp>/health-plan-patients.json
   ```

2. Generate exactly one 11-key JSON record per patient, in source order, following `references/health-plan-schema.md`. Write `<temp>/health-plan-records.json`. The builder—not generated JSON—sets the two status columns.
3. Set the output to the source directory unless the user specifies another location. Use `<source-stem>_健康管理方案.xlsx`. If the source directory is not writable, use `outputs/patient-health-plan/<source-stem>/`.
4. Run:

   ```bash
   <bundled-node> scripts/build_health_plan_workbook.mjs \
     --input <source.xlsx> \
     --records <temp>/health-plan-records.json \
     --template assets/health-management-plan-template.xlsx \
     --output <output.xlsx> \
     --preview <temp>/health-plan-preview.png
   ```

5. Reopen and verify the exact 13 headers, full source-order `userid` coverage, non-empty content, no prohibited missing-input placeholders, `已生成/待审核`, one table, no formula errors, and readable first/middle/last previews. Reject generic pharmacology: every reviewed medication needs its own mechanism, plan-specific use, execution point, and safety/monitoring paragraph. Reject summary-only health plans: require 4～6 actionable modules covering monitoring, medication, rehabilitation, diet, and follow-up/escalation, with at least two prospective frequencies, suggested targets, or action thresholds and no fabricated observed results.
6. Deliver only the final workbook unless the user asks for intermediates.

## Stage 3 — Medication Tracking and Medication List

1. Run:

   ```bash
   <bundled-node> scripts/extract_medication_tracking_patients.mjs \
     --input <source.xlsx> \
     --service-start YYYY-MM-DD \
     --service-end YYYY-MM-DD \
     --output <temp>/medication-tracking-patients.json
   ```

2. Generate exactly one four-key record per patient, in source order, following `references/medication-tracking-schema.md`. Keep `medicationItems` exactly aligned with the reviewed combined medications and prescription list; never add a medication. Write `<temp>/medication-tracking-records.json`.
3. Set both outputs to the source directory unless the user specifies another location. Use `<source-stem>_跟踪提醒.xlsx` and `<source-stem>_用药清单.xlsx`. If the source directory is not writable, use `outputs/patient-medication-tracking/<source-stem>/`.
4. Run:

   ```bash
   <bundled-node> scripts/build_medication_tracking_workbooks.mjs \
     --input <source.xlsx> \
     --records <temp>/medication-tracking-records.json \
     --service-start YYYY-MM-DD \
     --service-end YYYY-MM-DD \
     --tracking-template assets/medication-tracking-template.xlsx \
     --medication-template assets/medication-list-template.xlsx \
     --tracking-output <tracking-output.xlsx> \
     --medication-output <medication-output.xlsx> \
     --tracking-preview <temp>/tracking-preview.png \
     --medication-preview <temp>/medication-preview.png
   ```

5. Reopen and verify exact headers, full source-order patient coverage, no prohibited missing-input placeholders, service-period reminder formulas and allowed ranges, integer response rates of 45～70, intervention mapping from adverse-reaction level, medication confirmation times strictly later than activation in the same month and within `06:00:00–21:59:59`, one stable confirmation time shared by all medication rows for a patient, medication whitelist and order, Chinese frequency format, timing-only medication times, valid treatment days, one table per workbook, no formula errors, and readable first/middle/last previews of both workbooks.
6. Deliver both final workbooks and no intermediate files unless requested.

## Stage 4 — Adverse Reaction List

1. Run:

   ```bash
   <bundled-node> scripts/extract_adverse_reaction_patients.mjs \
     --input <source.xlsx> \
     --count N \
     --output <temp>/adverse-reaction-patients.json
   ```

2. Generate exactly one five-key JSON record per extracted patient in source order following `references/adverse-reaction-schema.md`. Generate only the clinical narrative fields; the builder sets occurrence time, severity, and intervention mapping.
3. Set the output to the source directory unless the user specifies another location. Use `<source-stem>_不良反应清单.xlsx`. If the source directory is not writable, use `outputs/patient-adverse-reaction/<source-stem>/`.
4. Run:

   ```bash
   <bundled-node> scripts/build_adverse_reaction_workbook.mjs \
     --input <source.xlsx> \
     --records <temp>/adverse-reaction-records.json \
     --count N \
     --template assets/adverse-reaction-list-template.xlsx \
     --output <output.xlsx> \
     --preview <temp>/adverse-reaction-preview.png
   ```

5. Reopen and verify exact headers, exactly `N` medium/high patients in source order, no prohibited missing-input placeholders, occurrence times strictly later than activation in the same month and within `06:00:00–21:59:59`, severity and intervention mapping, one table, no formula errors, and a readable preview.
6. Deliver only the final workbook unless the user asks for intermediates.

## Stop Conditions

- Stop and report missing or reordered required columns instead of guessing.
- Stop on duplicate/blank `userid`, invalid age, empty disease or plan name, unsupported product type, malformed records, or patient coverage mismatch.
- In stage 1, stop and report every affected `userid` when fewer than three distinct medications can be supported safely after the complete disease, procedure, age, sex, allergy, product, surgery, and symptom-support assessment. Never output one or two medications, omit a supportable first-line medication, force every patient to the same count, randomize the count, or pad the list with unrelated drugs. If more than five clinically indispensable roles remain after deduplication, stop and report the patient instead of silently dropping core therapy. Stop and report the affected `userid`, medication, and specification when a drug-specific unit is invalid or an exact approved specification cannot be supported; never repair it by guessing or silent unit conversion.
- In stage 2, stop if treatment or pharmacology content omits a reviewed medication, or if treatment content introduces a medication or procedure not present in the reviewed input.
- In stage 3, stop if the trigger omits an invalid `服务周期 YYYY-MM-DD 至 YYYY-MM-DD`, if the start is after the end, or if `患者标签` is not `无 | 轻度 | 中度 | 高度`; keep the existing intervention mapping `中度/高度 → 是` and `无/轻度 → 否`; stop and report the affected `userid` if no same-month confirmation timestamp exists strictly after activation within `06:00:00–21:59:59`; stop for the existing medication, prescription, timing, cycle, and allergy validation failures.
- In stage 4, accept `患者标签` values `无 | 轻度 | 中度 | 高度`, exclude `无`, and select `轻度/中度/高度` patients in source order. Stop if `数量：N` is missing or invalid, if fewer than `N` eligible patients exist, if a selected patient has no same-month timestamp strictly after activation within `06:00:00–21:59:59`, or if the fixed input/output schema, selected-patient order, occurrence-time boundary, or generated narrative contract fails. Copy severity from the label and map only `高度` to manual intervention `是`; map `轻度/中度` to `否`.
- Never overwrite either the source workbook or the user's reviewed workbook.
