---
name: generating-patient-full-course-data
description: Use when a user provides an Excel file and asks to generate 患者明细、患者全病程数据、出院后个性化医疗记录、联合用药、处方清单、器械匹配手术名称、全病程方案、健康管理方案、跟踪提醒、用药清单、不良反应清单或洞察报告, including “生成患者明细 依据文件：Excel路径”, “生成健康管理方案 依据文件：Excel路径”, “生成跟踪提醒和用药清单 依据文件：Excel路径 服务周期 YYYY-MM-DD 至 YYYY-MM-DD”, “生成不良反应清单 依据文件：Excel路径 数量：N”, and “生成洞察报告 产品：产品名 服务周期：YYYY-MM-DD 至 YYYY-MM-DD 依据以下文件：7份Excel”.
metadata:
  version: "1.1.14"
---

# Generating Patient Full-Course Data

Generate a template-matched workbook from one source `.xlsx` path. Preserve every source patient and use conservative clinical reasoning.

## Required Resources

- For stage 1, read `references/clinical-rules.md`, `references/drug-specification-rules.md`, and `references/record-schema.md` completely.
- For stage 2, read `references/health-plan-schema.md` completely.
- For stage 3, read `references/medication-tracking-schema.md` completely.
- For stage 4, read `references/adverse-reaction-schema.md` completely.
- For stage 5, read `references/insight-report-schema.md`, `references/insight-report-writing.md`, and `references/insight-report-template-contract.md` completely. Use `assets/patient-insight-report-generation-prompt-template.md.docx` as the authoritative source for the fixed report content and formatting contract.
- Use the matching bundled template in `assets/`; do not invent another layout.
- Use the bundled extractor and builder scripts; do not rewrite their workbook logic.
- Bundled Node scripts locate `@oai/artifact-tool` themselves via `scripts/lib/artifact_tool.mjs`: it honors `CODEX_NODE_MODULES` when set (e.g. after calling `load_workspace_dependencies` in Codex), otherwise it auto-detects a local Codex CLI runtime cache. No sub-skill call is required to run them in Claude Code or other environments.

## Route the Request

- `生成患者明细 依据文件：<source.xlsx> 公司：<company>` invokes stage 1; `公司` is optional and may be omitted or empty.
- `生成健康管理方案 依据文件：<source.xlsx>` invokes stage 2.
- `生成跟踪提醒和用药清单 依据文件：<source.xlsx> 服务周期 YYYY-MM-DD 至 YYYY-MM-DD` invokes stage 3.
- `生成不良反应清单 依据文件：<source.xlsx> 数量：N` invokes stage 4.
- `生成洞察报告` with a product, inclusive service period, and seven role-detectable Excel files invokes stage 5. `服务周期：` and `服务周期:` are both accepted. The bundled patient-insight-report prompt template always controls report content and format. An optional `输出Word文件模板：<template.docx>` line supplies additional visual page furniture only; it cannot replace the bundled nine-chapter content or formatting contract unless the user explicitly requests a deviation.
- An explicit trigger always wins. If the user supplies only a path, the exact reviewed 17-column contract invokes stage 2; stage 3 requires its explicit trigger and service period; otherwise use stage 1.
- Do not ask for fields already present in the workbook.

## Shared Setup

1. Bundled Node commands resolve `@oai/artifact-tool` on their own; in Codex, optionally call `load_workspace_dependencies` first to prime the cache and speed up the first run.
2. Create a temporary work directory.
3. In Codex, `CODEX_NODE_MODULES` is set automatically after `load_workspace_dependencies`; in other environments the scripts auto-detect the local Codex CLI runtime cache, or you can set `CODEX_NODE_MODULES` manually to a `node_modules` directory containing `@oai/artifact-tool`.
4. Never overwrite the source workbook.
5. Never emit language that describes absent input or references the source file, including `源文件未提供`, `未提供`, `未获取`, `暂无资料`, or equivalent placeholders. Omit an unsupported fact or its label instead; never fabricate content to fill the omission.

## Stage 1 — Patient Full-Course Details

1. Run:

   ```bash
   <bundled-node> scripts/extract_patients.mjs --input <source.xlsx> --output <temp>/patients.json
   ```

2. For each patient, first normalize and review `既往过敏史`. Exclude the documented allergen, its dosage-form or combination-product names, and every member of an explicitly documented allergy class before selecting any medication. Apply this gate to the supplied medicinal product as well: if the source product conflicts with the allergy history, stop and report the `userid`, allergy, and product instead of forcing it into the regimen, except in the company-specific exclusion below where the product is omitted from both generated medication fields. Build the remaining treatment roles in this order: a non-conflicting supplied medicinal product; etiologic, first-line, maintenance, or mandatory postoperative therapy; then each evidence-supported symptom-supportive medication. Decide whether a role is needed only from disease, procedure, age, sex, allergy history, product, and reviewed surgery. Select 1～5 distinct, directly indicated medications according to clinical need. A disease that is routinely managed with monotherapy or dual therapy, including uncomplicated vulvovaginal candidiasis and other clinically supportable local vaginal infection regimens, may retain one or two medications. Do not default every patient to the same number, and never add an unrelated, allergic, or contraindicated drug merely to reach an arbitrary count.
   - When the user explicitly authorizes simulated pain and inflammation stratification for an osteoarthritis cohort whose source contains no symptom-detail fields, use `scripts/generate_osteoarthritis_records.mjs --simulation-authorized yes`. It deterministically derives an internal mild, moderate, or severe stratum from `userid + 疾病`; the stratum is not a source fact and must not be written into source-derived columns. Preserve the supplied glucosamine product first. For moderate/severe strata, select one non-conflicting topical NSAID equivalent using `userid + disease + 外用抗炎镇痛`: `双氯芬酸二乙胺乳胶剂` or `氟比洛芬凝胶贴膏`. Add acetaminophen only for the severe stratum. Each added drug requires its own complete prescription entry and all normal allergy and specification validation still applies.
   - When `公司=山东利赛医药有限公司` and `产品类型=用药`, exclude the source `产品名称` from `联合用药` and from its active `处方清单` entry. Do not apply the normal “supplied medicinal product first” rule in this case. Keep other directly indicated medications and their complete prescriptions; if exclusion leaves no safe, directly indicated medication, stop and report the affected `userid` instead of padding the record. When `公司` is empty or names another company, preserve the normal product-first rule. Device products are never removed by this company rule.
3. When one treatment role has multiple clinically equivalent candidates, first remove candidates that fail indication, treatment-line, route, age, allergy, contraindication, or interaction checks. Call `scripts/equivalent_medication_selector.mjs` with the eligible candidate objects and the stable key `userid + disease + therapy role`. The userid selects only within an already eligible equivalent group; it must never create an indication or change the number of treatment roles. Keep exactly one candidate for the role. A one-candidate group stays unchanged.
4. Finalize and deduplicate `combinedMedication`, then generate exactly one complete prescription entry for each selected medication in the same order. Treat medication name, dosage form, specification, single dose, route, frequency, timing, duration, and warnings as one candidate-owned set. Judge the route dynamically from disease site, treatment role, treatment setting, patient safety facts, and the selected drug's supported routes; do not hard-code a disease to one route or default every injectable product to `肌内注射`. For airway-clearance goals, assess `雾化吸入`; for ophthalmic and soft-tissue goals, assess the corresponding local route, treating these as reasoning cues rather than unconditional mappings. If route fit conflicts with the treatment goal or dosage form, regenerate the entire candidate-owned set; if no supported route can be confirmed, stop and report the patient and drug. Validate each set against `references/drug-specification-rules.md`; never guess a strength, convert an unsupported unit, or retain parameters from a discarded alternative. Generate exactly one six-field record according to all stage-1 references and write `<temp>/records.json`.
5. After drafting all records, run a same-disease cohort review for every disease represented by at least two patients. For each shared treatment role with multiple eligible equivalents after all patient-specific safety filters, verify that every eligible patient used the stable selector instead of inheriting one default regimen for the entire disease group. If the cohort remains identical, re-evaluate the equivalent candidate groups and regenerate each affected prescription from the final selected candidate. Identical regimens remain valid when only one safe candidate remains or patient-specific facts leave one supported choice. Never change treatment roles, medication counts, doses, or durations merely to create diversity.
6. Set the output to the source directory unless the user specifies another location. Use `<source-stem>_患者全病程数据.xlsx`; if the source stem already contains `患者明细`, prefer `患者全病程数据_生成.xlsx`. If the source directory is not writable, use `outputs/patient-full-course/<source-stem>/`.
7. Run:

   ```bash
   <bundled-node> scripts/build_workbook.mjs \
     --input <source.xlsx> \
     --records <temp>/records.json \
   --template assets/patient-full-course-template.xlsx \
     --output <output.xlsx> \
     [--company <company>] \
     --preview <temp>/preview.png
   ```

8. Verify exact headers, source-order `userid`, one to five medications per patient, populated generated columns, no medication in `联合用药` or as an active prescription item in `处方清单` conflicts with `既往过敏史`, no prohibited missing-input placeholders or uncertain external-personnel intervention wording such as `由临床医生复核`/`由医生评估`, drug-specific specification units, dosage-form/package-unit compatibility, disease/therapy-goal route fit, no default `肌内注射` when the selected treatment goal supports another route, one table object, no formula errors, and readable first/middle/last previews. For repeated runs, verify that the same patient and eligible candidate groups produce the same medication choices; across patients, equivalent alternatives may differ without changing treatment roles or medication counts. For every same-disease cohort, confirm that an all-identical result is supported by one remaining safe option rather than an unreviewed default shared across the group.

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

5. Reopen and verify the exact 13 headers, full source-order `userid` coverage, non-empty content, no prohibited missing-input placeholders, `已生成/待审核`, one table, no formula errors, and readable first/middle/last previews. Reject generic or unrelated pharmacology: every reviewed medication needs its own medication-specific mechanism, patient/disease or surgery use, at least one recognizable detail from that medication's reviewed prescription, execution point, and safety/monitoring paragraph; reject paragraphs that describe another drug or unrelated diet/exercise content. In `AI药理科普`, allow `；` only between complete clauses; reject a leading `；`, `。；`/`：；`, repeated `；；`, or a trailing `；` as redundant punctuation. Reject `AI病例解读` text containing `全病程方案：<方案名称>` (or the ASCII-colon equivalent); the full-course plan name belongs only in the manager introduction and must not be emitted as a separate medical-record label. Reject external-basis wording in every output field, including `按审核处方` and similar phrases; write the supported action directly. Reject summary-only health plans: require 4～6 actionable modules covering monitoring, medication, rehabilitation, diet, and follow-up/escalation, with at least two prospective frequencies, suggested targets, or action thresholds and no fabricated observed results.
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
   Write the actual medication arrangement directly. Do not use `按已审核处方执行`, `按审核方案`, `依据经审定方案`, `根据已确认处方`, or similar external-basis wording in the medication plan, medication cycle, or medication items.
   For every medication item, output only the normalized specification value beginning with a number. Strip a source label separator such as `规格：` to produce `5mg/支`; never output `：5mg/支`, `规格5mg/支`, or explanatory specification prose. Preserve and validate the supported unit and dosage-form package convention.
   For `medicationCycle`, write one continuous duration statement; never use multi-stage wording such as `第一阶段` or `第二阶段`. Start directly with the medication or duration arrangement, for example, `抗感染疗程3-5天，镇痛及胃肠道对症治疗持续5-7天，视术后恢复情况停药。` Never begin with a calendar-date phrase such as `自2026-08-28起` or `自2026年-08-28起`, and never use the activation date or service-period dates as a narrative prefix.
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

5. Reopen and verify exact headers, full source-order patient coverage, no prohibited missing-input placeholders, service-period reminder formulas and allowed ranges, integer response rates of 45～70, intervention mapping from adverse-reaction level, medication confirmation times on or after the service-period start date, strictly later than activation, strictly earlier than the service-period end date, and within `07:00:00–21:59:59`, one stable confirmation time shared by all medication rows for a patient, medication whitelist and order, Chinese frequency format, timing-only medication times, valid treatment days, one table per workbook, no formula errors, and readable first/middle/last previews of both workbooks.
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

## Stage 5 — Patient Insight Report

1. Require `生成洞察报告`, a product, an inclusive `服务周期：YYYY-MM-DD 至 YYYY-MM-DD`, and seven `.xlsx` files. Optional cover metadata may be supplied as `委托方：<名称>` and `服务商：<名称>` lines; when omitted, those cover cells remain blank. Detect the seven source roles by headers and reject missing, duplicate or ambiguous roles. Read `assets/patient-insight-report-generation-prompt-template.md.docx` and `references/insight-report-template-contract.md`; these always control the final report's content and formatting. An output Word template is optional only as an additional visual layout source.
2. Run `scripts/extract_insight_sources.py` to create `insight.json`, then `scripts/generate_insight_charts.py` to create real PNG charts and a chart manifest.
3. Run `scripts/build_insight_report.py`. Pass `--client` and `--provider` to `scripts/extract_insight_sources.py` when the optional cover values are present. When the user supplies a visual Word template, pass it with `--template` and preserve its page settings, styles, headers and footers; otherwise use the bundled report layout. In every case, generate the fixed cover, dynamic table of contents, nine chapters, body page numbers starting at 1, and the bundled 28-point, title, table, chart and caption rules. Replace any sample body data with the extracted metrics. Default output is `患者洞察报告_<产品>_<YYYY-MM>.docx` beside the patient master workbook.
4. Run `scripts/validate_insight_report.py` to verify the bundled template asset exists, cover metadata, TOC field, body page field, nine top-level headings, fixed title hierarchy, continuous figure/table captions, no `图表说明：` paragraphs, 28-point body spacing, centered objects, blue table headers, chart media relationships, source reconciliation, and no prompt-template sample text or values. If LibreOffice (`soffice`) and poppler (`pdftoppm`) are installed, also run the documents skill `render_docx.py` (a standalone Python CLI, invocable directly via Bash) to render page images and confirm they are readable. If either dependency is missing, skip page rendering and state explicitly in the verification output that visual rendering was skipped and why; rely on `validate_insight_report.py`'s structural checks alone.

Stage 5's Python scripts need `python-docx`, `lxml`, `openpyxl`, and `Pillow`; the optional visual-render check in step 4 additionally needs `pdf2image` plus LibreOffice and poppler installed on the host (e.g. `pip install python-docx lxml pdf2image` and `brew install libreoffice poppler`). None of this is required to generate the stage-5 report itself — only to render page-image previews for the last verification step.

## Stop Conditions

- Stop and report missing or reordered required columns instead of guessing.
- Stop on duplicate/blank `userid`, invalid age, empty disease or plan name, unsupported product type, malformed records, or patient coverage mismatch.
- In stage 1, stop and report every affected `userid` when the supplied medicinal product conflicts with `既往过敏史`, or when no safe, directly indicated medication can be supported after the complete disease, procedure, age, sex, allergy, product, surgery, and symptom-support assessment. Regenerate any AI-selected conflict with a clinically equivalent non-conflicting option; never retain a documented allergen or a member of an explicitly documented allergy class in `联合用药` or as an active prescription item in `处方清单`. Retain clinically supportable one- or two-drug regimens; never omit a supportable first-line medication, force every patient to the same count, randomize the count, or pad the list with unrelated drugs. If more than five clinically indispensable roles remain after deduplication, stop and report the patient instead of silently dropping core therapy. Stop and report the affected `userid`, medication, and specification when a drug-specific unit is invalid or an exact approved specification cannot be supported; never repair it by guessing or silent unit conversion.
- In stage 2, stop if treatment or pharmacology content omits a reviewed medication, or if treatment content introduces a medication or procedure not present in the reviewed input.
- In stage 3, accept `患者标签` values `无 | 轻度 | 中度 | 高度 | 重度`, normalize `重度` to `高度`, and keep `无` distinct from `轻度` while mapping both to no manual intervention; stop if the trigger omits an invalid `服务周期 YYYY-MM-DD 至 YYYY-MM-DD`, if the start is after the end, or if another label is used; when an activation date equals the service-period end date, stop and report `<userid>的激活日期不能为服务周期最后一天，请修改激活日期` instead of omitting the patient; stop and report the affected `userid` if no confirmation timestamp exists on or after the service-period start date, strictly after activation, strictly before the service-period end date, and within `07:00:00–21:59:59`; stop for the existing medication, prescription, timing, cycle, and allergy validation failures.
- In stage 4, normalize `重度` to `高度`; stop if `数量：N` is missing or invalid, if fewer than `N` patients have a normalized `中度` or `高度` label, if a selected patient has no same-month timestamp strictly after activation within `06:00:00–21:59:59`, or if the fixed input/output schema, selected-patient order, occurrence-time boundary, or generated narrative contract fails.
- Never overwrite either the source workbook or the user's reviewed workbook.
