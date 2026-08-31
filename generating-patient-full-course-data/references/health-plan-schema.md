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

Use a consistent professional two-part introduction while personalizing the clinical context:

1. Start with this structure: `你好！我是您的AI健康管理师，我将为您提供全面专业的疾病管理支持，从病情监测、症状观察、用药管理到复诊规划，协助您更安全、有序地推进康复与长期管理。`
2. Follow with: `针对您的【个性化疾病或术后阶段】，我将结合“全病程方案名称”...` and explain that the plan organizes the current reviewed treatment, daily observation priorities, rehabilitation/lifestyle guidance, and follow-up coordination so the patient can understand and participate in the management process.

The bracketed context must contain the supplied disease, or the exact reviewed surgery plus `术后`; when there is no surgery, use a clinically neutral stage such as disease management, treatment, rehabilitation, or follow-up rather than inventing severity or a disease stage. Include the exact `coursePlanName`, and tailor the daily priorities to the reviewed disease, surgery, medications, age, and allergy history where relevant. Aim for 120～220 Chinese characters so the introduction is substantive but not repetitive.

Do not copy a sample disease into another patient's record. Do not use “保证”, “确保疗效”, “快速康复”, or “帮助您安全、高效地度过康复期”, because these can imply guaranteed safety, speed, or outcome. Do not describe measurements, symptoms, or treatment response as already observed.

### aiMedicalRecord

Use source facts only and include these labels on separate lines:

- `就诊科室：` — choose a conventional specialty from the disease; this is routing guidance, not a new diagnosis.
- `就诊日期：` — use the activation date.
- `处置：` — conservatively summarize only the reviewed disease, surgery, medication, prescription, and plan.

The reviewed input has no chief-complaint or physical-examination fields. Omit `主诉：` and `体征：` completely; do not output missing-input placeholders and do not simulate typical values or symptoms.

Never invent temperatures, pulse, respiratory rate, blood pressure, oxygen saturation, laboratory values, imaging results, pathological stage, chief complaint, symptoms, examination findings, contraindications, or treatment response.

### treatmentPlan

- Use `•` for each item and add a following classification line in the form `——【分类·作用】`.
- Only organize the reviewed `combinedMedication`, `prescriptionList`, and non-empty `surgeryName`.
- Do not add drugs, devices, procedures, injections, supplements, or “整改补充信息”.
- Every reviewed medication must appear by name. Preserve reviewed dose and schedule text where supplied; do not silently rewrite it.
- When surgery exists, it may be the first treatment item. Otherwise list reviewed medications only.

### aiPharmacology

Write one separate newline-delimited paragraph for every reviewed medication, beginning with that medication's exact name. Each medication paragraph must provide all four layers below instead of a generic drug-class label:

1. `药理机制` — explain in patient-friendly language how the drug acts, such as the enzyme, receptor, physiological process, microbial target, inflammatory pathway, secretion, absorption, replacement, or local tissue effect involved. State only a reliably known mechanism; do not invent one.
2. `本方案用途` — connect that mechanism to the supplied disease, reviewed surgery, or a documented treatment role. Do not claim that the patient already had a symptom that is not in the input.
3. `执行要点` — preserve or explain the reviewed route, timing, spacing, course, or administration technique when supplied. Do not silently change the prescription.
4. `主要风险与监测` — give medication-specific adverse-effect signals, interaction/spacing precautions, contraindication boundaries, or monitoring needs supported by that medication and the supplied allergy history.

Avoid boilerplate such as “该产品的具体作用、剂量和疗程以说明书及医生复核为准” as the whole explanation. For an uncertain product, it is acceptable to say that the mechanism requires product-instruction verification, but still explain the reviewed use, execution requirements, and observable safety signals conservatively. Explain each reviewed procedure/device in a separate paragraph when present. Every reviewed medication name must appear verbatim. Do not claim efficacy.

### aiHealthPlan

Provide a staged and actionable plan based on disease, age, surgery, and reviewed medication risks. Use 4～6 newline-delimited numbered modules beginning with `①` through `⑥`; each module must describe actions, frequency or timing, an observation target, and what to do when the target is not met where clinically applicable. Across the modules, cover all of these domains:

- disease/symptom or postoperative monitoring;
- medication execution and medication-specific safety;
- activity, rehabilitation, rest, or functional recovery;
- diet or nutrition management appropriate to the disease;
- follow-up or escalation when findings worsen.

Include at least two quantitative frequencies, suggested targets, or action thresholds, such as “每日记录1次”, “每2～3小时活动一次”, “疼痛评分持续高于某阈值时联系医生”, or a broadly accepted safety threshold when applicable. These are prospective `建议目标` or `行动阈值`, never observed patient results. Do not create a baseline circumference, current pain score, measured vital sign, laboratory result, or promised downward trend. When a numeric target depends on absent organ function, comorbidity, examination, or clinician-set parameters, state that the target follows the treating clinician's individualized goal instead of inventing it.

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
- Never mention the source file or describe absent input with wording such as `源文件未提供`, `未提供`, `未获取`, `未记录`, or `暂无资料`. Omit unsupported facts and their labels instead of fabricating replacements.
