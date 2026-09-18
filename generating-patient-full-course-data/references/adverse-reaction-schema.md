# Adverse Reaction List Schema

## Input and Selection

Accept the reviewed patient workbook in the current 16-column sequence, the legacy 17-column sequence below, or the compatible 18-column sequence with `耗材名称` inserted after `手术名称`:

`序号 | userid | 患者姓名 | 激活时间 | 性别 | 年龄 | 疾病 | 手机号码 | 地区 | 患者标签 | 既往过敏史 | 联合用药 | 处方清单 | 手术名称 | 全病程方案名称 | AI状态 | 确认状态`

The trigger must include `数量：N`, where `N` is a positive integer. Accept `患者标签` values `正常 | 无 | 轻度 | 中度 | 高度 | 重度`, normalize legacy `无` to `正常` and `重度` to `高度`, then select patients whose normalized label is `轻度`, `中度` or `高度`; exclude every `正常` (including legacy `无`) patient. Preserve source order and select the first `N` eligible patients, with no repeated patient. Stop when fewer than `N` eligible patients exist instead of duplicating records.

The extractor emits patient context including `userid`, activation time, disease, adverse-reaction level, age, gender, allergy history, combined medication, prescription list, surgery name, consumable name when present, and course-plan name. A consumable is not a medication and must not be introduced as a named drug intervention.

Resolve the current product from the user's `产品：<名称>`, the established task context, or the original product-bearing source when available. The reviewed 17-column input no longer has a product column: do not infer the current product from the first combined medication, because company exclusions and device products make that unreliable. Pass a known product as `--product <名称>` to both `extract_adverse_reaction_patients.mjs` and `build_adverse_reaction_workbook.mjs`; the extractor includes `productName` in internal patient context only. The five generated JSON keys and ten Excel columns remain unchanged. The flag is optional for legacy calls, but must not be omitted when the current product is known. If the product cannot be identified from available context, write symptom-only descriptions and state in internal verification that product-specific matching was unavailable; do not claim that named-product checking passed.

## Generated JSON

Generate exactly one record per selected patient in the extractor's order. Each record must contain exactly these five keys in order:

1. `userid`
2. `symptomDescription`
3. `treatmentMeasures`
4. `outcome`
5. `remarks`

The builder derives the sequence number, disease, occurrence time, severity, and manual-intervention value. Do not generate those deterministic fields in JSON.

## Clinical Narrative Rules

- Use only manifestations plausibly related to the supplied disease, procedure, allergy and reviewed medication background. Do not add an unrelated organ-system reaction.
- Do not invent a new diagnosis, laboratory or imaging result, vital-sign number, complication, hospitalization, contraindication, drug exposure, or treatment response.
- Describe symptoms conservatively as patient-observable complaints or warning signs. Do not state an unprovided causal relationship as certain; prefer neutral phrasing such as `出现` or `用药期间观察到`.
- `不良反应症状描述` (`symptomDescription`) must not contain current-product information: full product name, ingredient shorthand or known aliases/brand, manufacturer, model/specification, promotional or mechanism text, or references such as `本品`、`该产品`、`当前产品`、`该药`、`该器械`. Describe manifestations, body site, degree, timing and changes supported by the source. For example, with current product `注射用胰蛋白酶`, replace `使用注射用胰蛋白酶期间出现皮疹和瘙痒` with `出现皮疹和瘙痒` when that preserves the actual evidence. Do not replace the product with a pronoun, assign blame to another medicine, delete symptom facts, or invent a different reaction. This exclusion is specific to the symptom-description column; other fields retain their existing clinical and source-fidelity rules.
- Before export, `validateAdverseReactionRecord` rejects the normalized product name, common dosage-form shorthand and explicit product references in `symptomDescription`, even when that product is an allowed prescription drug. A rejected record must be rewritten and revalidated; do not weaken the check or remove `--product` to export it. During final review, also check known brand/aliases, manufacturer/model/specification and product-related prose that lexical matching may not recognize. Reopen the workbook and inspect the symptom-description column after export.
- Keep treatment measures proportional to the supplied `轻度`, `中度` or `高度` label. Include monitoring, pausing activity, contacting the relevant clinical service, medication review, or urgent evaluation only when clinically appropriate.
- Do not introduce a medication absent from `联合用药` or `处方清单`. Use `由医生评估是否调整现有用药` when the source cannot support a named intervention.
- Keep the outcome conservative: describe partial stabilization, ongoing observation, referral, or pending reassessment. Never promise recovery or invent normalized measurements.
- Use remarks for disease-specific danger signs, medication/allergy cautions, monitoring and follow-up. Do not repeat generic boilerplate unrelated to the patient.
- Never mention the source file or describe absent input with wording such as `源文件未提供`, `未提供`, `未获取`, `未记录`, or `暂无资料`. Omit unsupported narrative instead; never fabricate a replacement.

## Deterministic Fields

- `不良反应发生时间`: generate a stable timestamp strictly later than `激活时间`, in the same year and month, with its clock time between `06:00:00` and `21:59:59` inclusive. Use the remaining legal seconds on the activation day first as part of the available window, then all legal daytime seconds on later days of the month. Stop and report the userid when the activation month contains no legal timestamp; never cross into the next month.
- `不良反应严重程度分级`: output the normalized `患者标签` (`轻度`, `中度` or `高度`); source `重度` must display as `高度`.
- `是否触发人工干预`: `高度` → `是`; `轻度` or `中度` → `否`.

## Output Workbook

Use exactly these ten headers from the bundled template:

`序号 | 患者ID | 疾病 | 不良反应发生时间 | 不良反应症状描述 | 不良反应严重程度分级 | 处理措施 | 处理结果/转归 | 是否触发人工干预 | 备注`

Generate exactly `N` rows, preserve selected patient order, and keep one table object. Never overwrite the reviewed source workbook.
