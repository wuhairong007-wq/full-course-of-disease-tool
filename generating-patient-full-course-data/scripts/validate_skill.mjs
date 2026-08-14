import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const skillDir = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const requiredFiles = [
  "SKILL.md",
  "agents/openai.yaml",
  "scripts/extract_patients.mjs",
  "scripts/build_workbook.mjs",
  "scripts/test_build_workbook.mjs",
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
assert.match(skill, /^---\nname: generating-patient-full-course-data\ndescription: .+\n---\n/);
assert.match(skill, /^description: .*生成患者明细.*依据文件.*Excel路径.*$/m);
assert.doesNotMatch(skill, /TODO|TBD|\[TODO/);
assert.match(skill, /references\/clinical-rules\.md/);
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
assert.match(skill, /first determine 1～5 clinically supported medications/);
assert.match(skill, /never force the same count across patients or randomize the count/);
assert.match(skill, /生成患者明细 依据文件：<source\.xlsx>/);
assert.match(skill, /生成健康管理方案 依据文件：<source\.xlsx>/);
assert.match(skill, /生成跟踪提醒和用药清单 依据文件：<source\.xlsx>/);
assert.match(skill, /service-period reminder formulas/);
assert.match(skill, /integer response rates of 45～70/);
assert.match(skill, /medication confirmation times strictly later than activation in the same month and within `06:00:00–21:59:59`/);
assert.match(skill, /生成不良反应清单 依据文件：<source\.xlsx> 数量：N/);

const medicationSchema = await fs.readFile(path.join(skillDir, "references", "medication-tracking-schema.md"), "utf8");
assert.match(medicationSchema, /体温监测次数.*血压、心率监测次数.*用药提醒次数/s);
assert.match(medicationSchema, /Never use it to calculate.*medication cycle/s);
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

const adverseSchema = await fs.readFile(path.join(skillDir, "references", "adverse-reaction-schema.md"), "utf8");
assert.match(adverseSchema, /Select only patients whose `患者标签` is `中度` or `高度`/);
assert.match(adverseSchema, /fewer than `N` eligible patients exist/);
assert.match(adverseSchema, /strictly later than `激活时间`.*same year and month.*`06:00:00` and `21:59:59`/s);
assert.match(adverseSchema, /`高度` → `是`; `中度` → `否`/);
assert.match(adverseSchema, /Do not introduce a medication absent from `联合用药` or `处方清单`/);

const schema = await fs.readFile(path.join(skillDir, "references", "record-schema.md"), "utf8");
assert.match(schema, /1–5/);
assert.match(schema, /same-order one-to-one mapping/);
assert.doesNotMatch(schema, /1–6|\["无"\]/);
assert.match(schema, /include the supplied product first/);
assert.match(schema, /must not target a fixed count, randomize the count/);

const clinicalRules = await fs.readFile(path.join(skillDir, "references", "clinical-rules.md"), "utf8");
assert.match(clinicalRules, /1–5/);
assert.match(clinicalRules, /treat the supplied `产品名称` as a source-reviewed medication and include it first/);
assert.match(clinicalRules, /Do not target a fixed medication count, randomize the count/);
assert.doesNotMatch(clinicalRules, /\["无"\]/);

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
