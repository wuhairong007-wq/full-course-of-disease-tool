# Medication Tracking and List Schema

## Input Workbook

Accept the reviewed patient workbook with these required headers in this exact order:

`序号 | userid | 患者姓名 | 激活时间 | 性别 | 年龄 | 疾病 | 手机号码 | 地区 | 患者标签 | 既往过敏史 | 联合用药 | 处方清单 | 手术名称 | 全病程方案名称 | AI状态 | 确认状态`

For stage 3, keep the reviewed 17-column workbook unchanged. Read adverse-reaction level from `患者标签`; accept `无 | 轻度 | 中度 | 高度 | 重度`, and normalize `重度` to `高度` before all downstream logic. Keep `无` distinct from `轻度`; both map to no manual intervention. Require the trigger to include `服务周期 YYYY-MM-DD 至 YYYY-MM-DD`, parse both dates, and reject missing/invalid periods or a start after the end. Preserve every non-empty row, `userid`, source order, patient name, activation time, gender, age, disease, allergy history, combined medication, and prescription list. Reject blank or duplicate `userid`, invalid age or activation date, invalid patient labels, blank disease, blank combined medication, blank prescription list, or reordered headers. Do not substitute medication duration for the service period.

The extractor emits:

- `userid`, `patientName`, `activateDate`, `serviceStartDate`, `serviceEndDate`, `adverseReactionLevel` (from `患者标签`), `gender`, `age`, `diseaseName`, `allergyHistory`
- `combinedMedication`: non-empty array split from the reviewed `+`-separated field
- `prescriptionList`, `treatmentPlan`, `surgeryName`, `coursePlanName`

Use the reviewed `activateDate` as the medication-cycle anchor when a date is written; do not substitute the service-period dates.

## Generated JSON

Generate exactly one record per patient in source order with exactly these four keys:

1. `userid`
2. `medicationPlan`
3. `medicationCycle`
4. `medicationItems`

Each `medicationItems` entry must have exactly these seven keys:

1. `drugName`
2. `specification`
3. `singleDose`
4. `frequency`
5. `medicationTime`
6. `treatmentDays`
7. `precautions`

## Medication Plan

- Write concise, individualized Chinese text covering the actual disease, age group, gender, reviewed medications, adherence, monitoring, and clinician review.
- Describe only the medications already present in `combinedMedication` and `prescriptionList`.
- State the medication names, timing, duration, monitoring, and review actions directly. Do not write `按已审核处方执行`, `按审核方案`, `依据经审定方案`, `根据已确认处方`, or similar wording that depends on an external reviewed or confirmed basis.
- When `treatmentPlan` exists, keep the plan consistent with it and do not introduce another treatment.
- Do not promise efficacy or invent diagnoses, examinations, contraindications, complications, or response.

## Medication Cycle

- Derive the cycle from the reviewed prescription, disease logic, age, gender, and supplied treatment plan.
- Write one continuous medication-duration statement rather than a staged schedule. Do not use `阶段`, `第一阶段`, `第二阶段`, `第三阶段`, `分阶段`, or similar phase labels.
- State each medication's duration directly in the continuous sentence; do not use an audited, reviewed, or confirmed prescription or plan as the reason for the duration.
- Write the reviewed activation date as the narrative anchor when supplied, for example: `自2026-07-19起，抗感染疗程3-5天，镇痛及胃肠道对症治疗持续5-7天，视术后恢复情况停药。` Do not replace it with the service-period start or end date, and do not calculate a relative offset such as“激活后第7天”。
- Never extend a reviewed finite course or convert a finite course into long-term therapy without source support.
- When the source does not provide a reliable duration, use conservative wording requiring clinician confirmation rather than inventing a duration.

## Medication Items

- `drugName`: must exactly equal one item in `combinedMedication`. Every reviewed medication appears exactly once and in the same order. No other drug is allowed.
- `specification`: preserve the clinically supported specification value from the prescription and normalize only its surrounding label punctuation. Output the value alone, beginning with a number, such as `20mg/粒`, `0.5g/片`, `5mg/支`, `4000单位/支`, or `1%（20g/支）`. Never output a leading `：`/`:`, the word `规格`, or explanatory prose. Keep the exact supported unit convention; do not invent or silently convert a strength.
- Validate the normalized specification against `drug-specification-rules.md`: it must contain a recognized numeric strength, concentration, potency, activity, or biological unit; tablet and capsule package denominators must match `/片` and `/粒`; injectables and potency-labelled drugs must retain their approved unit convention.
- `singleDose`: preserve the reviewed dose, including age-adjusted content. Do not silently revise it.
- `frequency`: use Chinese quantitative forms such as `每日1次`, `每日2次`, `每8小时1次`, or `每周1次`. Do not use `qd`, `bid`, `tid`, `q8h`, `prn`, or an unquantified `必要时`.
- `medicationTime`: contain only a normalized timing phrase such as `早餐前`, `餐后`, `餐后1小时`, `晚餐中`, `睡前`, `早晚`, `固定时间`, or a quantified equal interval. Do not put administration routes such as `口服`, `吸入`, `肌肉注射`, `静脉注射`, or `静脉滴注` here, and do not use non-timing text such as `按医嘱`.
- `treatmentDays`: use a positive integer when the reviewed course gives a fixed number of days; otherwise use exactly `长期` or `无限期` only when the source explicitly supports it. Stop and report the affected `userid` when the reviewed prescription does not support any of these values; do not invent a duration.
- `precautions`: include medication-specific safety advice. Mention every supplied non-empty allergy history. For multi-drug regimens, require clinician/pharmacist review of combined-medication interactions or spacing without inventing a specific interaction. Include bleeding, hepatic, renal, or age-related cautions only when supported. Do not invent an allergy or contraindication.
- Generated medication items must also avoid claims such as `审核处方限量` or `已确认方案要求`; write the supported limit or safety action directly.

## Tracking Reminder Workbook

Use exactly these 16 headers from the bundled template:

`序号 | 患者ID | 姓名 | 性别 | 年龄 | 疾病 | 既往过敏史 | 联合用药 | 体温监测次数 | 血压、心率监测次数 | 用药提醒次数 | 用药方案 | 用药周期 | 方案链接 | 患者响应率 | 是否触发人工干预`

Generate one row per input patient in source order. Validate the full trigger-supplied service period, then let `D = max(服务结束日期 - 患者激活日期 + 1, 1)` using calendar days. The service start date does not replace the patient activation date in this formula. Generate stable per-user pseudorandom values so rerunning the same input and service period is reproducible while values vary between patients:

- `体温监测次数 = round(2 × D × random[0.4, 0.9))`
- `血压、心率监测次数 = round(D × random[0.5, 0.85))`
- `用药提醒次数 = round(3 × D × random[0.6, 0.85))`
- `患者响应率`: integer from 45 through 70 inclusive; store the integer and let the page display it with `%`.
- `是否触发人工干预`: `中度` or `高度` → `是`; `无` or `轻度` → `否`.

Leave `方案链接` blank because the input does not establish it.

## Medication List Workbook

Use exactly these nine headers from the bundled template:

`userid | 用药方案确认时间 | 药品名称 | 规格 | 单次剂量 | 用药频率 | 用药时间 | 疗程天数 | 注意事项`

Flatten medication items in patient order and reviewed medication order. Generate `用药方案确认时间` once per patient and reuse the same confirmation timestamp for every medication row belonging to that patient. The confirmation timestamp must be strictly later than `激活时间`, on or after the service-period start date, strictly earlier than the service-period end date, and fall between `07:00:00` and `21:59:59` inclusive. The service-period final day is an exclusive boundary and can never contain a confirmation timestamp. Generate it stably from `userid`, activation time, service-period start date, and service-period end date so rerunning the same inputs produces the same value. When a patient's activation date equals the service-period end date, stop and report `<userid>的激活日期不能为服务周期最后一天，请修改激活日期`; never silently omit that patient or generate partial output. Stop and report the affected `userid` if no legal timestamp remains inside the service period and strictly after activation; never generate a timestamp before the service start or on the service-period final day. This timestamp is record metadata only and must not derive, anchor, or describe `medicationCycle`. A `userid` therefore appears once per reviewed medication, while the distinct userid set must exactly equal the input set.

## Compliance Checks

- Preserve all source `userid` values; never omit, add, merge, or change patients.
- Do not add any medication absent from the reviewed combined medication and prescription list.
- Keep the medication plan, cycle, and item list mutually consistent. The plan names every reviewed medication, and each item's specification, dose, frequency, and duration match its reviewed prescription segment.
- Verify every medication confirmation timestamp is strictly later than activation, on or after the service-period start date, strictly earlier than the service-period end date, within `07:00:00–21:59:59`, identical across that patient's medication rows, and stable across repeated generation.
- Keep content educational and subject to clinician/pharmacist review; it is not a real prescription.
- Generated fields must not mention the source file or describe absent input with wording such as `源文件未提供`, `未提供`, `未获取`, `未记录`, or `暂无资料`. Omit unsupported narrative instead; never fabricate a replacement.
