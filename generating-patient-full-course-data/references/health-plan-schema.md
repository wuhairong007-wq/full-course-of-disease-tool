# Health Management Plan Record Schema

## Reviewed Input Workbook

The first worksheet must contain exactly these 17 headers, in this order:

`序号 | userid | 患者姓名 | 激活时间 | 性别 | 年龄 | 疾病 | 手机号码 | 地区 | 患者标签 | 既往过敏史 | 联合用药 | 处方清单 | 手术名称 | 全病程方案名称 | AI状态 | 确认状态`

Each non-empty data row is one patient. Preserve all `userid` values, their original text representation, count, and order. Reject blank or duplicate `userid`, invalid age, blank disease, blank full-course plan name, blank combined medication, and any header mismatch.

The extractor emits these normalized keys:

- `userid`
- `activateTime`
- `gender`
- `age`
- `disease`
- `allergyHistory`
- `combinedMedication` as a non-empty string array split from the reviewed `+`-separated cell
- `prescriptionList`
- `surgeryName`
- `coursePlanName`

## Generated JSON Record

Generate exactly these 11 keys in this order, with no additions:

1. `userid`
2. `aiManagerIntro`
3. `aiMedicalRecord`
4. `treatmentPlan`
5. `aiPharmacology`
6. `aiHealthPlan`
7. `monitoringIndicators`
8. `lifestyleAvoid`
9. `lifestyleRecommend`
10. `followupPlan`
11. `emergencyReminder`

All ten content fields must be non-empty Chinese text. Status fields are not generated record keys; the workbook builder fixes them to `已生成` and `待审核`.

## Output Workbook

The output contains exactly these 13 headers, in this order:

`userid | AI健康管理师介绍 | AI病历解读 | 治疗方案梳理 | AI药理科普 | AI健康管理方案 | 建议监测指标 | 生活方式建议_必须避免 | 生活方式建议_建议执行 | 复诊计划 | 紧急就医提醒 | AI状态 | 审核状态`

Generate exactly one row for every input patient, in source order. Do not expose names, phone numbers, or other input-only columns.

## Field Requirements

### aiManagerIntro

Introduce the AI health manager's monitoring, medication education, rehabilitation, diet, and follow-up support. Refer to the actual disease, reviewed surgery when present, and full-course plan. Do not promise outcomes.

### aiMedicalRecord

Use source facts only and include all of these labels on separate lines:

- `就诊科室：` — choose a conventional specialty from the disease; this is routing guidance, not a new diagnosis.
- `就诊日期：` — use the activation date when available; otherwise write `源文件未提供`.
- `主诉：源文件未提供`
- `体征：源文件未提供`
- `处置：` — conservatively summarize only the reviewed disease, surgery, medication, prescription, and plan.

Never invent temperatures, pulse, respiratory rate, blood pressure, oxygen saturation, laboratory values, imaging results, pathological stage, chief complaint, symptoms, examination findings, contraindications, or treatment response.

### treatmentPlan

- Use `•` for each item and add a following classification line in the form `——【分类·作用】`.
- Only organize the reviewed `combinedMedication`, `prescriptionList`, and non-empty `surgeryName`.
- Do not add drugs, devices, procedures, injections, supplements, or “整改补充信息”.
- Every reviewed medication must appear by name. Preserve reviewed dose and schedule text where supplied; do not silently rewrite it.
- When surgery exists, it may be the first treatment item. Otherwise list reviewed medications only.

### aiPharmacology

Explain the common role, general mechanism/category when reliably known, and important precautions of every reviewed medication and reviewed procedure/device when present. Every reviewed medication name must appear verbatim. For an uncertain product, state conservatively that its role, dose, course, and mechanism require verification against the product instructions and clinician review. Do not claim efficacy.

### aiHealthPlan

Provide a staged, actionable plan based on disease, age, surgery, and reviewed medication risks. Use at least `①`, `②`, and `③`. Include monitoring, activity/rehabilitation, diet, and medication adherence. Do not invent individualized target values that require absent clinical measurements.

### monitoringIndicators

At least four newline-separated indicators with a frequency or action threshold. Use broadly accepted safety thresholds only when applicable; otherwise say that the target follows the treating clinician's individualized goal. Do not imply that a measurement was observed.

### lifestyleAvoid

At least four newline-separated `•` items tailored to the disease, surgery, and medication risks.

### lifestyleRecommend

At least four newline-separated `•` items that are concrete and feasible. Avoid prescribing fixed fluid or nutrient quantities when organ function and comorbidities are unknown; qualify them with clinician guidance where necessary.

### followupPlan

At least two newline-separated `•` items. Give practical time points and the purpose of review. Add an earlier-care instruction for new or worsening symptoms without claiming a diagnosis.

### emergencyReminder

At least four newline-separated danger signals beginning with `⚠`. Tailor them to disease, surgery, anticoagulants, allergies, or other reviewed medication risks. End with an urgent-care instruction.

## Cross-Field Compliance

- Keep `userid` unchanged and cover every input patient exactly once.
- Use only supplied patient facts; do not fabricate history, comorbidities, tests, staging, contraindications, complications, or outcomes.
- `treatmentPlan` and `aiPharmacology` must each contain every medication in `combinedMedication`.
- The treatment plan must not introduce medication or procedure names outside the reviewed medication list and surgery name.
- Keep advice educational and subject to clinician review; it must not replace diagnosis or a real prescription.
