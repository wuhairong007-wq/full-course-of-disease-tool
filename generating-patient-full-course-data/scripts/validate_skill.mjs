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
  "scripts/drug_specification_validator.mjs",
  "scripts/test_drug_specification_validator.mjs",
  "scripts/equivalent_medication_selector.mjs",
  "scripts/test_equivalent_medication_selector.mjs",
  "scripts/extract_health_plan_patients.mjs",
  "scripts/build_health_plan_workbook.mjs",
  "scripts/test_health_plan_workbook.mjs",
  "scripts/extract_medication_tracking_patients.mjs",
  "scripts/build_medication_tracking_workbooks.mjs",
  "scripts/medication_confirmation_time.mjs",
  "scripts/test_medication_tracking_workbooks.mjs",
  "scripts/test_medication_confirmation_time.mjs",
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
  "assets/patient-full-course-template.xlsx",
  "assets/health-management-plan-template.xlsx",
  "assets/medication-tracking-template.xlsx",
  "assets/medication-list-template.xlsx",
  "assets/adverse-reaction-list-template.xlsx",
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
assert.match(skill, /3～5/);
assert.match(skill, /build treatment roles in this order/);
assert.match(skill, /Continue the full assessment until 3～5 distinct, directly indicated medications are selected/);
assert.match(skill, /Within that range, let clinical need determine the count/);
assert.match(skill, /fewer than three distinct medications can be supported safely/);
assert.match(skill, /Never emit language that describes absent input or references the source file/);
assert.match(skill, /symptom-supportive medication/i);
assert.match(skill, /equivalent_medication_selector\.mjs/);
assert.match(skill, /userid \+ disease \+ therapy role/i);
assert.match(skill, /same-disease cohort.*multiple eligible equivalents.*stable selector/s);
assert.match(skill, /Never change treatment roles, medication counts, doses, or durations merely to create diversity/);
assert.match(skill, /生成患者明细 依据文件：<source\.xlsx>/);
assert.match(skill, /生成健康管理方案 依据文件：<source\.xlsx>/);
assert.match(skill, /生成跟踪提醒和用药清单 依据文件：<source\.xlsx>/);
assert.match(skill, /service-period reminder formulas/);
assert.match(skill, /integer response rates of 45～70/);
assert.match(skill, /medication confirmation times strictly later than activation, strictly earlier than the service-period end date, in the same month, and within `06:00:00–21:59:59`/);
assert.match(skill, /生成不良反应清单 依据文件：<source\.xlsx> 数量：N/);

const medicationSchema = await fs.readFile(path.join(skillDir, "references", "medication-tracking-schema.md"), "utf8");
assert.match(medicationSchema, /体温监测次数.*血压、心率监测次数.*用药提醒次数/s);
assert.match(medicationSchema, /Use the reviewed `activateDate` as the medication-cycle anchor/s);
assert.match(medicationSchema, /must exactly equal one item in `combinedMedication`/);
assert.match(medicationSchema, /Do not put administration routes/);
assert.match(medicationSchema, /positive integer.*`长期` or `无限期`/s);
assert.match(medicationSchema, /specification, dose, frequency, and duration match/);
assert.match(medicationSchema, /combined-medication interactions/);
assert.match(medicationSchema, /患者标签.*服务周期/s);
assert.match(medicationSchema, /round\(2 × D × random\[0\.4, 0\.9\)\)/);
assert.match(medicationSchema, /45 through 70 inclusive/);
assert.match(medicationSchema, /`中度` or `高度` → `是`/);
assert.match(medicationSchema, /strictly later than `激活时间`.*same year and month.*`06:00:00` and `21:59:59`/s);
assert.match(medicationSchema, /same confirmation timestamp for every medication row belonging to that patient/);
assert.match(medicationSchema, /confirmation timestamp must be strictly earlier than the service-period end date/s);
assert.match(medicationSchema, /activation date equals the service-period end date.*stop.*修改激活日期/s);
assert.match(medicationSchema, /must not mention the source file or describe absent input/);

const adverseSchema = await fs.readFile(path.join(skillDir, "references", "adverse-reaction-schema.md"), "utf8");
assert.match(adverseSchema, /Select only patients whose `患者标签` is `中度` or `高度`/);
assert.match(adverseSchema, /fewer than `N` eligible patients exist/);
assert.match(adverseSchema, /strictly later than `激活时间`.*same year and month.*`06:00:00` and `21:59:59`/s);
assert.match(adverseSchema, /`高度` → `是`; `中度` → `否`/);
assert.match(adverseSchema, /Do not introduce a medication absent from `联合用药` or `处方清单`/);
assert.match(adverseSchema, /Never mention the source file or describe absent input/);

const schema = await fs.readFile(path.join(skillDir, "references", "record-schema.md"), "utf8");
assert.match(schema, /3–5/);
assert.match(schema, /same-order one-to-one mapping/);
assert.doesNotMatch(schema, /1–6|\["无"\]/);
assert.doesNotMatch(schema, /1–5/);
assert.match(schema, /include the supplied product first/);
assert.match(schema, /fewer than three medications are supportable.*stop and report/s);
assert.match(schema, /must not contain language that references the source file or describes absent input/);
assert.match(schema, /替换后.*规格.*剂量.*频次.*疗程/s);
assert.match(schema, /不得同时开具同一治疗作用的多个等效候选药物/);
assert.match(schema, /same-disease cohort.*multiple eligible equivalents.*stable selector/s);
assert.match(schema, /identical regimens.*only one safe candidate remains/si);
assert.match(schema, /注射用胰蛋白酶.*5万单位.*5mg/s);

const clinicalRules = await fs.readFile(path.join(skillDir, "references", "clinical-rules.md"), "utf8");
assert.match(clinicalRules, /3–5/);
assert.doesNotMatch(clinicalRules, /1–5/);
assert.match(clinicalRules, /treat the supplied `产品名称` as a source-reviewed medication and include it first/);
assert.match(clinicalRules, /fewer than three safe, directly indicated medications.*stop and report/s);
assert.match(clinicalRules, /有明确依据的对症支持药物/);
assert.match(clinicalRules, /Never describe absent input or mention the source file in generated content/);
assert.match(clinicalRules, /userid.*疾病.*治疗作用/s);
assert.match(clinicalRules, /同一治疗作用只选择一种/);
assert.match(clinicalRules, /same-disease cohort.*multiple eligible equivalents.*stable selector/s);
assert.match(clinicalRules, /Never change treatment roles, medication counts, doses, or durations merely to create diversity/);
assert.match(clinicalRules, /注射用胰蛋白酶.*5万单位.*5mg/s);
assert.doesNotMatch(clinicalRules, /\["无"\]/);

const healthPlanSchema = await fs.readFile(path.join(skillDir, "references", "health-plan-schema.md"), "utf8");
assert.match(healthPlanSchema, /Omit `主诉：` and `体征：` completely/);
assert.match(healthPlanSchema, /Never mention the source file or describe absent input/);

const generatedContentValidator = await fs.readFile(path.join(skillDir, "scripts", "generated_content_validator.mjs"), "utf8");
assert.match(generatedContentValidator, /源文件/);
assert.match(generatedContentValidator, /未提供/);
assert.match(generatedContentValidator, /暂无/);
assert.match(generatedContentValidator, /原表/);
assert.match(generatedContentValidator, /无法获取/);
assert.match(generatedContentValidator, /不详/);
const clinicalMedicationValidator = await fs.readFile(path.join(skillDir, "scripts", "clinical_medication_validator.mjs"), "utf8");
assert.match(clinicalMedicationValidator, /药品类产品必须作为联合用药第一项/);
assert.match(clinicalMedicationValidator, /未满18岁/);
assert.match(clinicalMedicationValidator, /过敏/);
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
