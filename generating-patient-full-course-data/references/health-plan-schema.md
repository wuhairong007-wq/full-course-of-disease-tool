# Health Management Plan Record Schema

## Reviewed Input Workbook

`联合用药` may be replaced in place by `关联厂家用药` in every supported layout. Read `manufacturer-medication.md`; normalize the single reviewed product to the same `combinedMedication` array and do not add medications. The stage-2 output uses the fixed health-plan headers below.

The first worksheet may use the current 16-column sequence, the legacy 17-column sequence below, or the compatible 18-column sequence with `耗材名称` inserted after `手术名称`. The legacy 17-column form is normalized to an empty consumable name; trailing historical status columns are ignored.

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

`userid | AI健康管理师介绍 | 门诊病历摘要 | 关联产品临床应用方案 | AI药理科普 | AI健康管理方案 | 建议监测指标 | 生活方式建议_必须避免 | 生活方式建议_建议执行 | 复诊计划 | 紧急就医提醒 | AI状态 | 审核状态`

Generate exactly one row for every input patient, in source order. Do not expose names, phone numbers, or other input-only columns.

## Field Requirements

### aiManagerIntro

Use a consistent professional two-part introduction while personalizing the clinical context:

1. Start with this structure: `你好！我是您的AI健康管理师，我将为您提供全面专业的疾病管理支持，从病情监测、症状观察、用药管理到复诊规划，协助您更安全、有序地推进康复与长期管理。`
2. Follow with: `针对您的【个性化疾病或术后阶段】，我将结合“全病程方案名称”...` and explain that the plan organizes the current reviewed treatment, daily observation priorities, rehabilitation/lifestyle guidance, and follow-up coordination so the patient can understand and participate in the management process.

The bracketed context must contain the supplied disease, or the exact reviewed surgery plus `术后`; when there is no surgery, use a clinically neutral stage such as disease management, treatment, rehabilitation, or follow-up rather than inventing severity or a disease stage. Include the exact `coursePlanName`, and tailor the daily priorities to the reviewed disease, surgery, medications, age, and allergy history where relevant. For device patients, the explicit current product supplied as `产品：<名称>` must not appear in this field; use the same current/legacy device signals defined for `treatmentPlan`. For medication patients, the product name may appear when clinically relevant to the reviewed medication management. Aim for 120～220 Chinese characters so the introduction is substantive but not repetitive.

Do not copy a sample disease into another patient's record. Do not use “保证”, “确保疗效”, “快速康复”, or “帮助您安全、高效地度过康复期”, because these can imply guaranteed safety, speed, or outcome. Do not describe measurements, symptoms, or treatment response as already observed.

### aiMedicalRecord (output header: `门诊病历摘要`)

The stage-2 trigger authorizes typical-consultation simulation for this field by default. Pass `--mode fictional-test` and mark the output filename `模拟` (legacy `虚构测试` also accepted). Do not put `模拟检查提示`, `模拟采集提示`, `非已观察结果`, `非患者已报告症状` or other simulation/factual-status disclaimers inside this field. An explicit real-evidence/no-simulation request selects `--mode real`; it overrides this default. The builder itself defaults to real when no mode is passed.

Include exactly these six nonempty labels in order on separate lines:

- `就诊科室：` — choose a conventional specialty from the disease; this is routing guidance, not a new diagnosis.
- `就诊日期：` — use the activation date.
- `主诉：` — describe a typical reason for attendance with duration, matching the disease, anatomical site and course-plan phase. This may be symptoms, postoperative review or disease follow-up; do not force pain or another symptom into an asymptomatic presentation. Do not substitute `门诊拟询问` or an interview checklist in simulated mode.
- `体征：` — write specific plausible vital signs and clinically relevant local examination findings, using units, such as `T 36.5℃，P 80次/分，BP 156/94mmHg`. Choose findings in context, not a universal normal examination template. Do not substitute `门诊拟检查` in simulated mode.
- `处置：` — include the exact disease name and professionally interpret the complaint/findings within the reviewed plan phase. Describe relevant assessment, indicated investigations, reviewed treatment execution, postoperative care if applicable, and escalation. Do not introduce active drugs or procedures beyond the reviewed medication/surgery input; simulated findings never authorize new prescriptions or unsupported diagnoses.
- `复诊：` — state the reviewed follow-up timing and purpose from the prescription/course context, plus earlier review for worsening or urgent symptoms as appropriate.

Before writing, read `disease` and `coursePlanName` together. The plan must preserve the supplied disease wording; stop when the source disease and plan conflict. Resolve anatomical site, acute/chronic context and preoperative/postoperative phase. Before export, review every patient for all three relationships: disease/plan, complaint/findings and disposition/phase. Consult applicable authoritative clinical guidance when the expected presentation or management is uncertain.

- In the requested default typical hypertension scenario, use an elevated reading rather than a normal-BP template; include `BP` or `血压` with a numeric pair and `mmHg` or `毫米汞柱`. The targeted simulation check uses systolic ≥140 and/or diastolic ≥90. This is not a claim that real treated hypertension always has high BP, and must never override an actual source reading. Clinical reference: WHO, *Hypertension*, https://www.who.int/news-room/fact-sheets/detail/hypertension.
- A postoperative plan must describe postoperative review/care, not claim that the same first operation has not occurred. Do not repeat preoperative symptoms as current postoperative symptoms without a coherent clinical reason.
- The user's right-upper-quadrant-pain/laparoscopic-surgery example illustrates concrete clinical writing, not a universal regimen. Never copy abdominal surgery, antibiotics, fasting until flatus or suture removal into unrelated disease/procedure cases. Use only applicable perioperative advice.
- Simulate only consultation detail needed for this field. Do not invent laboratory/imaging confirmation, pathological staging, contraindications, treatment response, complications or completed interventions merely to make the narrative richer. Preserve all real source facts, allergy history, current medications and surgery. Never propagate simulated findings into other fields as genuine evidence.
- Machine validation catches selected structural and known clinical conflicts; passing it does not establish general clinical correctness. Patient-specific semantic review remains mandatory.

Do not add a separate `全病程方案：` label or repeat the full-course plan name in this field. Use the plan for clinical reasoning; its exact title belongs in `aiManagerIntro`.

In explicit real mode, the fixed reviewed-input workbook contains no actual complaint or examination columns. Use plain prospective `主诉：门诊拟询问受累关节症状及对日常活动的影响` and `体征：门诊拟检查受累关节活动情况及局部体征`, tailored to the disease, without disclaimer parentheses. Do not generate measurements or patient-reported/observed findings in this mode. If the user instead supplies actual consultation evidence, preserve it and arrange an explicit evidence-aware input contract rather than silently inventing or dropping observations.

### treatmentPlan (output header: `关联产品临床应用方案`)

- Use `•` for each item and add a following classification line in the form `——【分类·作用】`.
- Only organize the reviewed `combinedMedication`, `prescriptionList`, and non-empty `surgeryName`.
- Do not add drugs, devices, procedures, injections, supplements, or “整改补充信息”.
- Every reviewed medication must appear by name. Preserve reviewed dose and schedule text where supplied; do not silently rewrite it.
- When surgery exists, it may be the first treatment item. Otherwise list reviewed medications only.
- When the patient is a device patient, the explicit current product supplied as `产品：<名称>` must not appear anywhere in this field. The current 16/18-column input identifies a device patient with a non-empty `耗材名称`; the legacy 17-column input uses a non-empty `手术名称` as the compatible device signal. Do not compensate by adding a product-only treatment item. For medication patients, the product name may and normally must appear when it is one of the reviewed `combinedMedication` items.
- Do not output standalone punctuation or symbol joins such as `。+。`.

### aiPharmacology

Write one separate newline-delimited paragraph for every reviewed medication, beginning with that medication's exact name. Each medication paragraph must provide all four layers below instead of a generic drug-class label:

1. `药理机制` — explain in patient-friendly language how the drug acts, such as the enzyme, receptor, physiological process, microbial target, inflammatory pathway, secretion, absorption, replacement, or local tissue effect involved. State only a reliably known mechanism; do not invent one.
2. `本方案用途` — connect that mechanism to the supplied disease, reviewed surgery, or a documented treatment role. Do not claim that the patient already had a symptom that is not in the input.
3. `执行要点` — preserve or explain the reviewed route, timing, spacing, course, or administration technique when supplied. Include at least one recognizable medication-specific detail from that medication's reviewed prescription (such as specification, dose, frequency, timing, route, or duration). Do not silently change the prescription.
4. `主要风险与监测` — give medication-specific adverse-effect signals, interaction/spacing precautions, contraindication boundaries, or monitoring needs supported by that medication and the supplied allergy history.

Avoid unrelated disease, diet, exercise, or generic drug-class prose in this field: every paragraph must explain the corresponding medication, its supplied patient-specific use, execution detail, and safety monitoring. Do not use `按审核处方`, `按审核方案`, `依据经审定方案`, `根据已确认处方`, `已审核用药`, or equivalent wording that asks the reader to consult another reviewed/confirmed source; write the supported medication, use, timing, dose, duration, and action directly. Avoid boilerplate such as “该产品的具体作用、剂量和疗程以说明书及医生复核为准” as the whole explanation. For an uncertain product, it is acceptable to say that the mechanism requires product-instruction verification, but still explain the reviewed use, execution requirements, and observable safety signals conservatively. Explain each reviewed procedure/device in a separate paragraph when present. Every reviewed medication name must appear verbatim. Do not claim efficacy. Use `；` only as an internal clause separator; do not output a leading or trailing `；`, `。；`, `：；`, repeated `；；`, or standalone punctuation/symbol joins such as `。+。` in any medication paragraph.

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
- Use only supplied patient facts outside the explicitly authorized simulated `aiMedicalRecord` scenario. Do not fabricate history, comorbidities, tests, staging, contraindications, complications or outcomes. A simulated summary is not new clinical evidence for the treatment plan, pharmacology, health-management baseline or later stages.
- All ten content fields must avoid `辅助对症`, `辅助性对症`, `非患者已报告症状`, `非已观察结果`, `拟采集提示`, `模拟检查提示` and equivalent meta-commentary. State the supported drug use or action directly. Simulated medical summaries use concrete typical consultation information; only real-mode summaries use plain `门诊拟询问` / `门诊拟检查` when observations are absent. The simulation filename marker must remain present.
- `treatmentPlan` and `aiPharmacology` must each contain every medication in `combinedMedication`.
- `AI药理科普` must contain only one medication/device paragraph per reviewed item; reject unrelated medication introductions, generic pharmacology summaries, and paragraphs whose use or execution details belong to another item.
- Every generated field must avoid external-basis wording such as `按审核处方`, `按审核方案`, `依据经审定方案`, `根据已确认处方`, `已审核用药`, or equivalent phrases; state the supported action directly.
- The treatment plan must not introduce medication or procedure names outside the reviewed medication list and surgery name.
- Keep advice educational and subject to clinician review; it must not replace diagnosis or a real prescription.
- Never mention the source file or describe absent input with wording such as `源文件未提供`, `未提供`, `未获取`, `未记录`, or `暂无资料`. Omit unsupported facts and their labels instead of fabricating replacements.
