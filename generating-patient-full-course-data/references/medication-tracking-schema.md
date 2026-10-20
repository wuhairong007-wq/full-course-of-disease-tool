# Medication Tracking and List Schema

## Input Workbook

`联合用药` may be replaced in place by `关联厂家用药` in every supported layout. Read `manufacturer-medication.md`; normalize that single product to `combinedMedication` and generate exactly one medication-list row per patient. For this input variant, omit the medication column from the tracking workbook and require the four precaution sections below in the medication list. Ordinary inputs retain the `联合用药` column and existing precaution rules.

Accept the reviewed patient workbook in the current 16-column sequence, the legacy 17-column sequence below, or the compatible 18-column sequence with `耗材名称` inserted after `手术名称`:

`序号 | userid | 患者姓名 | 激活时间 | 性别 | 年龄 | 疾病 | 手机号码 | 地区 | 患者标签 | 既往过敏史 | 联合用药 | 处方清单 | 手术名称 | 全病程方案名称 | AI状态 | 确认状态`

For stage 3, keep the reviewed workbook unchanged and treat a missing legacy `耗材名称` as empty. Read adverse-reaction level from `患者标签`; accept `正常 | 无 | 轻度 | 中度 | 高度 | 重度`, and normalize legacy `无` to `正常` and `重度` to `高度` before all downstream logic. Keep `正常` distinct from `轻度`; both map to no manual intervention. Require the trigger to include `服务周期 YYYY-MM-DD 至 YYYY-MM-DD`, parse both dates, and reject missing/invalid periods or a start after the end. Preserve every non-empty row, `userid`, source order, patient name, activation time, gender, age, disease, allergy history, combined medication, prescription list, and consumable context. Reject blank or duplicate `userid`, invalid age or activation date, invalid patient labels, blank disease, blank combined medication, blank prescription list, or reordered headers. Never create a medication item from `耗材名称`. Do not substitute medication duration for the service period.

The extractor emits:

- `userid`, `patientName`, `activateDate`, `serviceStartDate`, `serviceEndDate`, `adverseReactionLevel` (from `患者标签`), `gender`, `age`, `diseaseName`, `allergyHistory`
- `combinedMedication`: non-empty array split from the reviewed `+`-separated field
- `prescriptionList`, `treatmentPlan`, `surgeryName`, `coursePlanName`

Do not use `activateDate` or either service-period date as a narrative prefix for the medication cycle. Start the cycle directly with the medication or duration arrangement.

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
- Start directly with the medication or duration arrangement, for example: `抗感染疗程3-5天，镇痛及胃肠道对症治疗持续5-7天，视术后恢复情况停药。` Never begin with a calendar-date phrase such as `自2026-08-28起`, `自2026年-08-28起`, or equivalent wording, and do not calculate a relative offset such as“激活后第7天”。
- Never extend a reviewed finite course or convert a finite course into long-term therapy without source support.
- When the source does not provide a reliable duration, use conservative wording requiring clinician confirmation rather than inventing a duration.

## Medication Items

- `drugName`: must exactly equal one item in `combinedMedication`. Every reviewed medication appears exactly once and in the same order. No other drug is allowed.
- `specification`: preserve the clinically supported specification value from the prescription and normalize only its surrounding label punctuation. Output the value alone, beginning with a number, such as `20mg/粒`, `0.5g/片`, `5mg/支`, `4000单位/支`, or `1%（20g/支）`. Never output a leading `：`/`:`, the word `规格`, or explanatory prose. Keep the exact supported unit convention; do not invent or silently convert a strength.
- Validate the normalized specification against `drug-specification-rules.md`: it must contain a recognized numeric strength, concentration, potency, activity, or biological unit; tablet and capsule package denominators must match `/片` and `/粒`; injectables and potency-labelled drugs must retain their approved unit convention.
- `singleDose`: preserve the reviewed dose, including age-adjusted content. Do not silently revise it.
- `frequency`: use Chinese quantitative forms such as `单次`, `每日1次`, `每日2次`, `每8小时1次`, or `每周1次`. Use `单次` only when the reviewed prescription explicitly states single-use administration. Do not use `qd`, `bid`, `tid`, `q8h`, `prn`, or an unquantified `必要时`.
- `medicationTime`: output only concrete 24-hour clock times in zero-padded `HH:mm` format, separated by an ASCII comma and one space. Convert `早中晚` to `08:00, 12:00, 18:00` and `早晚` to `08:00, 18:00`; a single morning/noon/evening reminder uses `08:00`, `12:00`, or `18:00` respectively. Preserve explicit source clock times when present. Use valid hours `00`–`23` and minutes `00`–`59`, list times in ascending order without duplicates, and match the number of times to a fixed `每日N次` frequency or one time for `单次`. Do not output timing phrases (`早晚`, `早中晚`, `餐后`, `睡前`, `固定时间`), routes, dates, seconds, or prose in this field.
- Do not put administration routes such as `口服`, `吸入`, `肌肉注射`, `静脉注射`, or `静脉滴注` in `medicationTime`.
- These clock times are planned reminders, not observed administration times. Keep source-supported meal, fasting, bedtime, procedure-related timing and medication-spacing requirements in `precautions`, and choose compatible clock times. The morning/noon/evening defaults do not override a specific administration constraint. Derive an equal-interval prescription such as `每8小时1次` from its supported starting time and preserve the interval instead of using the meal-time defaults. Keep non-daily dates or variable-frequency conditions in the plan/precautions. If a concrete schedule cannot be established without contradicting the prescription or inventing an unknown procedure time, stop and report the affected `userid` and drug rather than silently assigning a clock time.
- `treatmentDays`: use a positive integer when the reviewed course gives a fixed number of days. Map an explicit `单次服用`、`单次给药`、`单次使用`、`单次注射` or corresponding `一次性` wording to `1`; otherwise use exactly `长期` or `无限期` only when the source explicitly supports it. Stop and report the affected `userid` when the reviewed prescription does not support any of these values; do not invent a duration.
- `precautions`: include medication-specific safety advice. Mention every supplied non-empty allergy history. For multi-drug regimens, require clinician/pharmacist review of combined-medication interactions or spacing without inventing a specific interaction. Include bleeding, hepatic, renal, or age-related cautions only when supported. Do not invent an allergy or contraindication.
- For `关联厂家用药` input only, write `precautions` as four separate newline-delimited sections with these exact labels and substantive content:
  1. `饮食禁忌：` — provide supported food restrictions and administration-with-food guidance. Do not invent restrictions on foods or alcohol. If no specific food restriction is supported, give the supported meal timing or tell the patient to confirm food restrictions with a pharmacist; never assert that the medicine has no food interactions.
  2. `合并用药：` — explain the supported interaction or spacing precautions. When no actual co-medication is established, use conditional wording such as “如正在服用其他药品，使用前咨询医生或药师核对相互作用”; do not add a drug to the regimen or assert concurrent use.
  3. `用药观察：` — describe relevant observable adverse-effect signals and the action to take; preserve the patient's documented allergy history and existing safety advice.
  4. `储存保存：` — use the applicable product instructions and packaging. Do not guess a temperature, shelf life, refrigeration requirement, or packaging material from the generic name. When these details are not verified, give the actionable instruction to retain the original packaging and follow its marked storage conditions, keep it out of children's reach, and check the expiry date.
  Keep all four sections inside the existing `注意事项` cell, not as new workbook columns. Empty labels or punctuation alone are invalid. Research applicable official product instructions before adding medical details; never copy a different product's storage conditions.
- Generated medication items must also avoid claims such as `审核处方限量` or `已确认方案要求`; write the supported limit or safety action directly.

## Tracking Reminder Workbook

For ordinary `联合用药` inputs, use exactly these 16 headers from the bundled template:

`序号 | 患者ID | 姓名 | 性别 | 年龄 | 疾病 | 既往过敏史 | 联合用药 | 体温监测次数 | 血压、心率监测次数 | 用药提醒次数 | 用药方案 | 用药周期 | 方案链接 | 患者响应率 | 是否触发人工干预`

For `关联厂家用药` inputs, derive the output from the same template by removing the medication column, shifting its following columns and their formatting left. The worksheet and its table must have exactly these 15 headers, with no blank placeholder column and no renamed `联合用药` substitute:

`序号 | 患者ID | 姓名 | 性别 | 年龄 | 疾病 | 既往过敏史 | 体温监测次数 | 血压、心率监测次数 | 用药提醒次数 | 用药方案 | 用药周期 | 方案链接 | 患者响应率 | 是否触发人工干预`

This removes only the separate medication column; keep the medication names in `用药方案` and `用药周期` and retain the complete medication list.

Generate one row per input patient in source order. Generate the patient's `用药方案确认时间` first, then validate the full trigger-supplied service period and let `D = max(服务结束日期 - 用药方案确认时间 + 1, 1)` using the confirmation timestamp's calendar date. The service start date and patient activation date do not replace the confirmation date in this formula. Generate stable per-user pseudorandom values so rerunning the same input and service period is reproducible while values vary between patients:

- `体温监测次数 = round(2 × D × random[0.4, 0.9))`
- `血压、心率监测次数 = round(D × random[0.5, 0.85))`
- `用药提醒次数 = round(3 × D × random[0.6, 0.85))`
- `患者响应率`: integer from 45 through 70 inclusive; store the integer and let the page display it with `%`.
- `是否触发人工干预`: `中度` or `高度` → `是`; `无` or `轻度` → `否`.

Leave `方案链接` blank because the input does not establish it.

## Medication List Workbook

Use exactly these nine headers from the bundled template:

`userid | 用药方案确认时间 | 药品名称 | 规格 | 单次剂量 | 用药频率 | 用药时间 | 疗程天数 | 注意事项`

Flatten medication items in patient order and reviewed medication order. Generate `用药方案确认时间` once per patient and reuse the same confirmation timestamp for every medication row belonging to that patient. Use the activation period to choose exactly one target window: 上午激活（before `12:00:00`）uses 当日下午 `12:00:00–21:59:59`; 下午激活（at or after `12:00:00`）uses 次日上午 `07:30:00–11:59:59`. Select a stable second from the intersection of that target window and `[serviceStart, serviceEnd)`. The service-period final day is an exclusive boundary and can never contain a confirmation timestamp. When a patient's activation date equals the service-period end date, stop and report `<userid>的激活日期不能为服务周期最后一天，请修改激活日期`; never silently omit that patient or generate partial output. If the 目标时间窗口 does not intersect the 服务周期, stop the whole build, report the affected `userid` and conflicting window, and produce neither workbook. There is 无其他日期或时段兜底: never change activation, move to another date, widen the target window, or omit the patient. This timestamp is record metadata only and must not derive, anchor, or describe `medicationCycle`. A `userid` therefore appears once per reviewed medication, while the distinct userid set must exactly equal the input set.

## Compliance Checks

- Preserve all source `userid` values; never omit, add, merge, or change patients.
- Do not add any medication absent from the reviewed combined medication and prescription list.
- Keep the medication plan, cycle, and item list mutually consistent. The plan names every reviewed medication, and each item's specification, dose, frequency, and duration match its reviewed prescription segment.
- Verify every `用药时间` cell uses `HH:mm` values separated by `, `, with no legacy timing phrases, duplicate/out-of-order clocks or fixed daily-frequency count mismatches. Preserve administration requirements in `注意事项`.
- Verify every medication confirmation timestamp follows the activation-derived target window, lies inside `[serviceStart, serviceEnd)`, is strictly later than activation, is identical across that patient's medication rows, and is stable across repeated generation. Reject the whole build and report the affected `userid` when the target window is outside the service period.
- Keep content educational and subject to clinician/pharmacist review; it is not a real prescription.
- Generated fields must not mention the source file or describe absent input with wording such as `源文件未提供`, `未提供`, `未获取`, `未记录`, or `暂无资料`. Omit unsupported narrative instead; never fabricate a replacement.
