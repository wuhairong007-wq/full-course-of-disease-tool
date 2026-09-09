import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requiredFiles = [
  "SKILL.md",
  "agents/openai.yaml",
  "scripts/extract_patients.mjs",
  "scripts/build_workbook.mjs",
  "scripts/test_build_workbook.mjs",
  "scripts/generated_content_validator.mjs",
  "scripts/test_generated_content_validator.mjs",
  "scripts/clinical_medication_validator.mjs",
  "scripts/test_clinical_medication_validator.mjs",
  "scripts/test_route_judgment_rules.mjs",
  "scripts/build_insight_report.py",
  "scripts/extract_insight_sources.py",
  "scripts/generate_insight_charts.py",
  "scripts/insight_request_parser.mjs",
  "scripts/test_extract_insight_sources.py",
  "scripts/test_generate_insight_charts.py",
  "scripts/test_insight_request_parser.mjs",
  "scripts/validate_insight_report.py",
  "scripts/test_validate_insight_report.py",
  "scripts/drug_specification_validator.mjs",
  "scripts/test_drug_specification_validator.mjs",
  "scripts/equivalent_medication_selector.mjs",
  "scripts/test_equivalent_medication_selector.mjs",
  "scripts/extract_health_plan_patients.mjs",
  "scripts/build_health_plan_workbook.mjs",
  "scripts/health_plan_content_validator.mjs",
  "scripts/test_health_plan_workbook.mjs",
  "scripts/test_health_plan_content_validator.mjs",
  "scripts/extract_medication_tracking_patients.mjs",
  "scripts/build_medication_tracking_workbooks.mjs",
  "scripts/medication_confirmation_time.mjs",
  "scripts/medication_specification.mjs",
  "scripts/medication_tracking_wording_validator.mjs",
  "scripts/test_medication_tracking_workbooks.mjs",
  "scripts/test_medication_confirmation_time.mjs",
  "scripts/test_medication_specification.mjs",
  "scripts/test_medication_tracking_wording_validator.mjs",
  "scripts/extract_adverse_reaction_patients.mjs",
  "scripts/adverse_reaction_validation.mjs",
  "scripts/adverse_reaction_time.mjs",
  "scripts/build_adverse_reaction_workbook.mjs",
  "scripts/test_adverse_reaction_workbook.mjs",
  "scripts/test_adverse_reaction_validation.mjs",
  "scripts/test_adverse_reaction_time.mjs",
  "references/clinical-rules.md",
  "references/drug-specification-rules.md",
  "references/record-schema.md",
  "references/health-plan-schema.md",
  "references/medication-tracking-schema.md",
  "references/adverse-reaction-schema.md",
  "references/insight-report-schema.md",
  "references/insight-report-writing.md",
  "references/insight-report-template-contract.md",
  "assets/patient-full-course-template.xlsx",
  "assets/health-management-plan-template.xlsx",
  "assets/medication-tracking-template.xlsx",
  "assets/medication-list-template.xlsx",
  "assets/adverse-reaction-list-template.xlsx",
  "assets/patient-insight-report-generation-prompt-template.md.docx",
];
for (const file of requiredFiles) await fs.access(path.join(skillDir, file));

const skill = await fs.readFile(path.join(skillDir, "SKILL.md"), "utf8");
assert.match(skill, /^---\nname: generating-patient-full-course-data\ndescription: .+\nmetadata:\n  version: "[^"]+"\n---\n/);
const version = skill.match(/^  version: "([^"]+)"$/m)?.[1];
assert(version, "SKILL.md必须声明metadata.version");
assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, "metadata.version必须使用x.y.z语义化版本");
assert.match(skill, /^description: .*生成患者明细.*依据文件.*Excel路径.*$/m);
assert.doesNotMatch(skill, /TODO|TBD|\[TODO/);
assert.match(skill, /references\/clinical-rules\.md/);
assert.match(skill, /references\/drug-specification-rules\.md/);
assert.match(skill, /references\/record-schema\.md/);
assert.match(skill, /scripts\/extract_patients\.mjs/);
assert.match(skill, /scripts\/build_workbook\.mjs/);
assert.match(skill, /references\/health-plan-schema\.md/);
assert.match(skill, /scripts\/extract_health_plan_patients\.mjs/);
assert.match(skill, /scripts\/build_health_plan_workbook\.mjs/);
assert.match(skill, /references\/medication-tracking-schema\.md/);
assert.match(skill, /scripts\/extract_medication_tracking_patients\.mjs/);
assert.match(skill, /scripts\/build_medication_tracking_workbooks\.mjs/);
assert.match(skill, /references\/adverse-reaction-schema\.md/);
assert.match(skill, /scripts\/extract_adverse_reaction_patients\.mjs/);
assert.match(skill, /scripts\/build_adverse_reaction_workbook\.mjs/);
assert.match(skill, /1～5/);
assert.match(skill, /Build the remaining treatment roles in this order/);
assert.match(skill, /Select 1～5 distinct, directly indicated medications according to clinical need/);
assert.match(skill, /monotherapy or dual therapy/);
assert.match(skill, /no safe, directly indicated medication can be supported/);
assert.match(skill, /first normalize and review `既往过敏史`/);
assert.match(skill, /no medication in `联合用药` or as an active prescription item in `处方清单` conflicts with `既往过敏史`/);
assert.match(skill, /supplied medicinal product conflicts with `既往过敏史`/);
assert.match(skill, /Never emit language that describes absent input or references the source file/);
assert.match(skill, /symptom-supportive medication/i);
assert.match(skill, /equivalent_medication_selector\.mjs/);
assert.match(skill, /userid \+ disease \+ therapy role/i);
assert.match(skill, /same-disease cohort.*multiple eligible equivalents.*stable selector/s);
assert.match(skill, /Never change treatment roles, medication counts, doses, or durations merely to create diversity/);
assert.match(skill, /生成患者明细 依据文件：<source\.xlsx>/);
assert.match(skill, /公司.*optional|公司.*可选/s);
assert.match(skill, /山东利赛医药有限公司/);
assert.match(skill, /产品名称.*联合用药.*处方清单/s);
assert.match(skill, /生成健康管理方案 依据文件：<source\.xlsx>/);
assert.match(skill, /生成跟踪提醒和用药清单 依据文件：<source\.xlsx>/);
assert.match(skill, /service-period reminder formulas/);
assert.match(skill, /Reject generic or unrelated pharmacology/);
assert.match(skill, /Reject external-basis wording in every output field/);
assert.match(skill, /integer response rates of 45～70/);
assert.match(skill, /Do not use `按已审核处方执行`.*similar external-basis wording/s);
assert.match(skill, /Strip a source label separator such as `规格：` to produce `5mg\/支`/);
assert.match(skill, /Never begin with a calendar-date phrase such as `自2026-08-28起` or `自2026年-08-28起`/);
assert.match(skill, /medication confirmation times on or after the service-period start date, strictly later than activation, strictly earlier than the service-period end date, and within `07:00:00–21:59:59`/);
assert.match(skill, /生成不良反应清单 依据文件：<source\.xlsx> 数量：N/);
assert.match(skill, /生成洞察报告 产品：产品名 服务周期：YYYY-MM-DD 至 YYYY-MM-DD/);
assert.match(skill, /Stage 5 — Patient Insight Report/);
assert.match(skill, /scripts\/extract_insight_sources\.py/);
assert.match(skill, /scripts\/build_insight_report\.py/);
assert.match(skill, /documents skill `render_docx\.py`/);
assert.match(skill, /patient-insight-report-generation-prompt-template\.md\.docx/);
assert.match(skill, /insight-report-template-contract\.md/);
assert.match(skill, /输出Word文件模板.*visual|输出Word文件模板.*视觉/s);
assert.match(skill, /委托方.*服务商.*blank|委托方.*服务商.*留白/s);
assert.match(skill, /fixed cover.*dynamic table of contents.*body page numbers starting at 1/s);
assert.match(skill, /no `图表说明：` paragraphs/);

const medicationSchema = await fs.readFile(path.join(skillDir, "references", "medication-tracking-schema.md"), "utf8");
assert.match(medicationSchema, /体温监测次数.*血压、心率监测次数.*用药提醒次数/s);
assert.match(medicationSchema, /Do not use `activateDate` or either service-period date as a narrative prefix/s);
assert.match(medicationSchema, /must exactly equal one item in `combinedMedication`/);
assert.match(medicationSchema, /Do not put administration routes/);
assert.match(medicationSchema, /positive integer.*`长期` or `无限期`/s);
assert.match(medicationSchema, /specification, dose, frequency, and duration match/);
assert.match(medicationSchema, /combined-medication interactions/);
assert.match(medicationSchema, /患者标签.*服务周期/s);
assert.match(medicationSchema, /normalize `重度` to `高度`/);
assert.match(medicationSchema, /Keep `无` distinct from `轻度`/);
assert.match(medicationSchema, /round\(2 × D × random\[0\.4, 0\.9\)\)/);
assert.match(medicationSchema, /45 through 70 inclusive/);
assert.match(medicationSchema, /`中度` or `高度` → `是`; `无` or `轻度` → `否`/);
assert.match(medicationSchema, /Do not write `按已审核处方执行`.*similar wording that depends on an external reviewed or confirmed basis/s);
assert.match(medicationSchema, /Do not use `阶段`.*similar phase labels/s);
assert.match(medicationSchema, /Never begin with a calendar-date phrase such as `自2026-08-28起`, `自2026年-08-28起`/);
assert.match(medicationSchema, /Output the value alone, beginning with a number/);
assert.match(medicationSchema, /Never output a leading .*the word `规格`/);
assert.match(medicationSchema, /tablet and capsule package denominators must match `\/片` and `\/粒`/);
assert.match(medicationSchema, /strictly later than `激活时间`.*on or after the service-period start date.*`07:00:00` and `21:59:59`/s);
assert.match(medicationSchema, /same confirmation timestamp for every medication row belonging to that patient/);
assert.match(medicationSchema, /strictly earlier than the service-period end date/s);
assert.match(medicationSchema, /activation date equals the service-period end date.*stop.*修改激活日期/s);
assert.match(medicationSchema, /must not mention the source file or describe absent input/);

const adverseSchema = await fs.readFile(path.join(skillDir, "references", "adverse-reaction-schema.md"), "utf8");
assert.match(adverseSchema, /normalize `重度` to `高度`.*select only patients whose normalized label is `中度` or `高度`/s);
assert.match(adverseSchema, /fewer than `N` eligible patients exist/);
assert.match(adverseSchema, /strictly later than `激活时间`.*same year and month.*`06:00:00` and `21:59:59`/s);
assert.match(adverseSchema, /`高度` → `是`; `中度` → `否`/);
assert.match(adverseSchema, /Do not introduce a medication absent from `联合用药` or `处方清单`/);
assert.match(adverseSchema, /Never mention the source file or describe absent input/);

const schema = await fs.readFile(path.join(skillDir, "references", "record-schema.md"), "utf8");
assert.match(schema, /1–5/);
assert.match(schema, /same-order one-to-one mapping/);
assert.doesNotMatch(schema, /1–6|\["无"\]/);
assert.doesNotMatch(schema, /3–5/);
assert.match(schema, /include the supplied product first/);
assert.match(schema, /monotherapy or dual therapy/);
assert.match(schema, /If no medication is supportable.*stop and report/s);
assert.match(schema, /exclude every explicitly documented allergen and every member of an explicitly documented allergy class/);
assert.match(schema, /no medication conflicting with `allergyHistory` may appear in `combinedMedication` or as an active prescription item in `prescriptionList`/);
assert.match(schema, /must not contain language that references the source file or describes absent input/);
assert.match(schema, /替换后.*规格.*剂量.*频次.*疗程/s);
assert.match(schema, /不得同时开具同一治疗作用的多个等效候选药物/);
assert.match(schema, /same-disease cohort.*multiple eligible equivalents.*stable selector/s);
assert.match(schema, /identical regimens.*only one safe candidate remains/si);
assert.match(schema, /注射用胰蛋白酶.*5万单位.*5mg/s);

const clinicalRules = await fs.readFile(path.join(skillDir, "references", "clinical-rules.md"), "utf8");
assert.match(clinicalRules, /1–5/);
assert.doesNotMatch(clinicalRules, /3–5/);
assert.match(clinicalRules, /treat the supplied `产品名称` as a source-reviewed medication and include it first/);
assert.match(clinicalRules, /monotherapy or dual therapy/);
assert.match(clinicalRules, /If no safe, directly indicated medication remains.*stop and report/s);
assert.match(clinicalRules, /parse explicit drug names and explicitly named drug classes from `既往过敏史`/);
assert.match(clinicalRules, /A medicinal `产品名称` does not override allergy safety/);
assert.match(clinicalRules, /有明确依据的对症支持药物/);
assert.match(clinicalRules, /Never describe absent input or mention the source file in generated content/);
assert.match(clinicalRules, /userid.*疾病.*治疗作用/s);
assert.match(clinicalRules, /同一治疗作用只选择一种/);
assert.match(clinicalRules, /same-disease cohort.*multiple eligible equivalents.*stable selector/s);
assert.match(clinicalRules, /Never change treatment roles, medication counts, doses, or durations merely to create diversity/);
assert.match(clinicalRules, /注射用胰蛋白酶.*5万单位.*5mg/s);
assert.doesNotMatch(clinicalRules, /\["无"\]/);
assert.match(clinicalRules, /Disease-Aware Route Judgment/);
assert.match(clinicalRules, /结合疾病解剖部位.*治疗作用.*药品剂型/s);
assert.match(clinicalRules, /不得建立“疾病名称→固定给药途径”的硬编码映射/);
assert.match(clinicalRules, /雾化吸入.*推理线索/);
assert.match(clinicalRules, /停止该患者生成并报告患者、药物和冲突原因/);

const insightSchema = await fs.readFile(path.join(skillDir, "references", "insight-report-schema.md"), "utf8");
assert.match(insightSchema, /七类工作簿/);
assert.match(insightSchema, /服务响应率/);
const insightWriting = await fs.readFile(path.join(skillDir, "references", "insight-report-writing.md"), "utf8");
assert.match(insightWriting, /正文叙述密度/);
assert.match(insightWriting, /固定 28 磅行距/);
assert.match(insightWriting, /insight-report-template-contract\.md/);
const insightTemplateContract = await fs.readFile(path.join(skillDir, "references", "insight-report-template-contract.md"), "utf8");
assert.match(insightTemplateContract, /一、报告概述/);
assert.match(insightTemplateContract, /九、总结/);
assert.match(insightTemplateContract, /固定 28 磅行距/);
assert.match(insightTemplateContract, /封面.*目录.*页码从 1/s);
assert.match(insightTemplateContract, /图注下不再输出“图表说明”/);
const insightParser = await fs.readFile(path.join(skillDir, "scripts", "insight_request_parser.mjs"), "utf8");
assert.match(insightParser, /sourcePaths\.length !== 7/);
assert.match(insightParser, /templatePath.*null/);
assert.match(insightParser, /extractOptionalValue/);
assert.match(insightParser, /委托方/);
assert.match(insightParser, /服务商/);
const insightExtractor = await fs.readFile(path.join(skillDir, "scripts", "extract_insight_sources.py"), "utf8");
assert.match(insightExtractor, /ROLE_RULES/);
assert.match(insightExtractor, /serviceRegion/);
assert.match(insightExtractor, /reportDate/);
const insightBuilder = await fs.readFile(path.join(skillDir, "scripts", "build_insight_report.py"), "utf8");
assert.match(insightBuilder, /bundled report contract/);
assert.match(insightBuilder, /if template_path else Document\(\)/);
assert.match(insightBuilder, /DEFAULT_REPORT_RULE_TEMPLATE/);
assert.match(insightBuilder, /TOC.*1-3/);
assert.match(insightBuilder, /_add_page_number/);
assert.match(insightBuilder, /w:start.*"1"/);
assert.doesNotMatch(insightBuilder, /图表说明：/);

const healthPlanSchema = await fs.readFile(path.join(skillDir, "references", "health-plan-schema.md"), "utf8");
assert.match(healthPlanSchema, /Omit `主诉：` and `体征：` completely/);
assert.match(healthPlanSchema, /Do not use `按审核处方`.*equivalent wording/s);
assert.match(healthPlanSchema, /only one medication\/device paragraph per reviewed item/);
assert.match(healthPlanSchema, /Never mention the source file or describe absent input/);

const healthPlanContentValidator = await fs.readFile(path.join(skillDir, "scripts", "health_plan_content_validator.mjs"), "utf8");
assert.match(healthPlanContentValidator, /externalBasisPattern/);
assert.match(healthPlanContentValidator, /validatePharmacologyParagraph/);
assert.match(healthPlanContentValidator, /validatePharmacologyContent/);

const generatedContentValidator = await fs.readFile(path.join(skillDir, "scripts", "generated_content_validator.mjs"), "utf8");
assert.match(generatedContentValidator, /源文件/);
assert.match(generatedContentValidator, /未提供/);
assert.match(generatedContentValidator, /暂无/);
assert.match(generatedContentValidator, /原表/);
assert.match(generatedContentValidator, /无法获取/);
assert.match(generatedContentValidator, /不详/);
const clinicalMedicationValidator = await fs.readFile(path.join(skillDir, "scripts", "clinical_medication_validator.mjs"), "utf8");
assert.match(clinicalMedicationValidator, /药品类产品必须作为联合用药第一项/);
assert.match(clinicalMedicationValidator, /山东利赛医药有限公司/);
assert.match(clinicalMedicationValidator, /shouldExcludeMedicinalProduct/);
assert.match(clinicalMedicationValidator, /未满18岁/);
assert.match(clinicalMedicationValidator, /过敏/);
assert.match(clinicalMedicationValidator, /extractAllergyTerms/);
assert.match(clinicalMedicationValidator, /喹诺酮/);
assert.match(clinicalMedicationValidator, /非甾体抗炎药/);
for (const builder of [
  "build_workbook.mjs",
  "build_health_plan_workbook.mjs",
  "build_medication_tracking_workbooks.mjs",
  "build_adverse_reaction_workbook.mjs",
]) {
  const builderText = await fs.readFile(path.join(skillDir, "scripts", builder), "utf8");
  assert.match(builderText, /validateGeneratedContent/);
}
const stageOneBuilder = await fs.readFile(path.join(skillDir, "scripts", "build_workbook.mjs"), "utf8");
assert.match(stageOneBuilder, /validateClinicalMedicationSelection/);
assert.match(stageOneBuilder, /--company|args\.company/);
assert.match(stageOneBuilder, /filterCompanyProduct/);

const drugSpecificationRules = await fs.readFile(path.join(skillDir, "references", "drug-specification-rules.md"), "utf8");
assert.match(drugSpecificationRules, /注射用胰蛋白酶/);
assert.match(drugSpecificationRules, /5万单位/);
assert.match(drugSpecificationRules, /5mg/);
assert.match(drugSpecificationRules, /never.*convert|Never.*convert/s);

const metadata = await fs.readFile(path.join(skillDir, "agents/openai.yaml"), "utf8");
assert.match(metadata, /display_name: "患者全病程数据生成"/);
assert.match(metadata, /short_description: ".{25,64}"/u);
assert.match(metadata, /default_prompt: "Use \$generating-patient-full-course-data/);
assert.match(metadata, /生成健康管理方案/);
assert.match(metadata, /生成跟踪提醒和用药清单/);
assert.match(metadata, /服务周期 YYYY-MM-DD 至 YYYY-MM-DD/);
assert.match(metadata, /生成不良反应清单/);
assert.match(metadata, /数量：N/);
assert.match(metadata, /allow_implicit_invocation: true/);

console.log(JSON.stringify({ status: "passed", skill: "generating-patient-full-course-data", files: requiredFiles.length }));
