import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { validateGeneratedContent } from "./generated_content_validator.mjs";

const nodeModules = process.env.CODEX_NODE_MODULES;
if (!nodeModules) throw new Error("缺少环境变量CODEX_NODE_MODULES；请使用load_workspace_dependencies返回的Node.js packages路径");
const runtimeRequire = createRequire(path.join(nodeModules, "package.json"));
const artifactToolPath = runtimeRequire.resolve("@oai/artifact-tool");
const { FileBlob, SpreadsheetFile } = await import(pathToFileURL(artifactToolPath).href);

const inputHeaders = [
  "序号", "userid", "患者姓名", "激活时间", "性别", "年龄", "疾病", "手机号码", "地区",
  "患者标签", "既往过敏史", "联合用药", "处方清单", "手术名称", "全病程方案名称", "AI状态", "确认状态",
];
const outputHeaders = [
  "userid", "AI健康管理师介绍", "AI病历解读", "治疗方案梳理", "AI药理科普", "AI健康管理方案",
  "建议监测指标", "生活方式建议_必须避免", "生活方式建议_建议执行", "复诊计划", "紧急就医提醒", "AI状态", "审核状态",
];
const recordKeys = [
  "userid", "aiManagerIntro", "aiMedicalRecord", "treatmentPlan", "aiPharmacology", "aiHealthPlan",
  "monitoringIndicators", "lifestyleAvoid", "lifestyleRecommend", "followupPlan", "emergencyReminder",
];
const contentKeys = recordKeys.slice(1);
const pharmacologyMechanismPattern = /机制|通过|抑制|阻断|拮抗|激动|促进|调节|补充|替代|中和|结合|减少|增加|稳定|松弛|抗菌|抗炎|镇痛|保护|吸收|分泌|代谢|酶|受体/;
const pharmacologyExecutionPattern = /服用|使用|给药|外用|涂抹|贴敷|注射|吸入|疗程|间隔|空腹|餐前|餐后|固定时间|按审核处方|遵医嘱/;
const pharmacologySafetyPattern = /注意|避免|监测|观察|风险|不良反应|咨询|就医|复核|过敏|停用|禁用/;
const healthPlanNumberedMarker = /^[①②③④⑤⑥]/;
const managerIntroOpening = "你好！我是您的AI健康管理师，我将为您提供全面专业的疾病管理支持";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`无效参数：${key ?? ""}`);
    args[key.slice(2)] = value;
  }
  for (const required of ["input", "records", "template", "output"]) {
    if (!args[required]) throw new Error(`缺少参数：--${required}`);
  }
  return args;
}

const normalize = (value) => String(value ?? "").trim();
const countLinesStarting = (text, marker) => normalize(text).split(/\r?\n/).filter((line) => line.trim().startsWith(marker)).length;

function parseTreatmentItemNames(text) {
  return normalize(text).split(/\r?\n/).filter((line) => line.trim().startsWith("•")).map((line) => {
    const item = line.trim().slice(1).trim();
    return normalize(item.split(/[：:]/)[0]);
  });
}

function validateMedicalRecord(userid, text) {
  if (/^(?:主诉|体征)[：:]/m.test(text)) {
    throw new Error(`${userid}的AI病历解读不得虚构主诉、体征或生命体征数值`);
  }
  for (const required of ["就诊科室：", "就诊日期：", "处置："]) {
    if (!text.includes(required)) throw new Error(`${userid}的AI病历解读缺少：${required}`);
  }
}

function validateManagerIntro(userid, text, patient) {
  const value = normalize(text);
  if (!value.startsWith(managerIntroOpening)) throw new Error(`${userid}的AI健康管理师介绍必须使用统一的专业开场结构`);
  if (!value.includes("病情监测") || !value.includes("症状观察") || !value.includes("用药管理") || !value.includes("复诊规划")) {
    throw new Error(`${userid}的AI健康管理师介绍必须说明病情监测、症状观察、用药管理和复诊规划服务`);
  }
  if (!/更安全、有序|安全、有序/.test(value)) throw new Error(`${userid}的AI健康管理师介绍必须使用合规的康复与长期管理表达`);
  const context = value.match(/【([^】]+)】/)?.[1] ?? "";
  const expectedContext = context.includes(patient.disease) || (patient.surgeryName && context.includes(patient.surgeryName));
  if (!expectedContext) throw new Error(`${userid}的AI健康管理师介绍必须在【】中体现实际疾病或已审核手术阶段`);
  if (!value.includes(patient.coursePlanName)) throw new Error(`${userid}的AI健康管理师介绍必须体现全病程方案名称`);
  if (!/每日|日常/.test(value) || !/重点|关注|管理要点/.test(value)) throw new Error(`${userid}的AI健康管理师介绍必须说明每日关注重点或日常管理要点`);
  if (value.length < 120 || value.length > 260) throw new Error(`${userid}的AI健康管理师介绍建议控制在120至260个字符并保持内容完整`);
  if (/帮助您安全、高效地度过康复期|保证|确保疗效|快速康复/.test(value)) throw new Error(`${userid}的AI健康管理师介绍含疗效、安全或康复速度承诺`);
}

function validatePharmacology(userid, text, patient) {
  const lines = normalize(text).split(/\r?\n/).map(normalize).filter(Boolean);
  for (const medication of patient.combinedMedication) {
    const line = lines.find((value) => value.startsWith(medication));
    if (!line) throw new Error(`${userid}的AI药理科普必须为${medication}单独分段并以药名开头`);
    if (line.length < medication.length + 45) throw new Error(`${userid}的${medication}药理科普过于简略，必须说明机制、用途、执行要点和风险监测`);
    if (!pharmacologyMechanismPattern.test(line)) throw new Error(`${userid}的${medication}药理科普缺少通俗药理机制`);
    if (!pharmacologyExecutionPattern.test(line)) throw new Error(`${userid}的${medication}药理科普缺少用法或疗程执行要点`);
    if (!pharmacologySafetyPattern.test(line)) throw new Error(`${userid}的${medication}药理科普缺少风险或监测提示`);
  }
  if (patient.surgeryName && !text.includes(patient.surgeryName)) throw new Error(`${userid}的AI药理科普遗漏已审核手术或器械：${patient.surgeryName}`);
}

function validateHealthPlan(userid, text) {
  const modules = normalize(text).split(/\r?\n/).map(normalize).filter((line) => healthPlanNumberedMarker.test(line));
  if (modules.length < 4 || modules.length > 6) throw new Error(`${userid}的AI健康管理方案必须包含4至6个①至⑥编号模块`);
  if (modules.some((module) => module.length < 38)) throw new Error(`${userid}的AI健康管理方案各模块必须包含具体动作、频次或时机及异常处理`);
  const domains = [
    [/监测|观察|记录|评估/, "病情监测"],
    [/用药|服药|药物|处方/, "用药执行"],
    [/活动|康复|锻炼|运动|步行|功能|休息/, "活动康复"],
    [/饮食|进食|营养|饮水/, "饮食营养"],
    [/复诊|随访|就医|联系医生|医疗机构|急诊/, "复诊升级"],
  ];
  for (const [pattern, label] of domains) if (!pattern.test(text)) throw new Error(`${userid}的AI健康管理方案缺少${label}模块`);
  const quantifiedGuidance = text.match(/每日(?:\d+次)?|每周(?:\d+次)?|每次|每\d+(?:[-～至]\d+)?小时|第\d+天|连续\d+天|目标|阈值|超过|低于|高于|≤|≥|<|>/g) ?? [];
  if (quantifiedGuidance.length < 2) throw new Error(`${userid}的AI健康管理方案必须包含至少2个监测频次、建议目标或行动阈值`);
  if (!/若|如|一旦|出现|持续|加重|超过|低于|高于|未改善|不缓解/.test(text)) throw new Error(`${userid}的AI健康管理方案必须说明异常或目标未达成时的处理动作`);
}

function validateRecord(record, patient) {
  const userid = patient.userid;
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`${userid}记录必须为对象`);
  if (JSON.stringify(Object.keys(record)) !== JSON.stringify(recordKeys)) throw new Error(`${userid}必须且只能依次包含11个健康方案字段`);
  if (record.userid !== userid) throw new Error(`${userid}的userid被改变`);
  for (const key of contentKeys) if (!normalize(record[key])) throw new Error(`${userid}的${key}不能为空`);
  validateGeneratedContent({ userid, fields: Object.fromEntries(contentKeys.map((key) => [key, record[key]])) });
  validateManagerIntro(userid, record.aiManagerIntro, patient);
  validateMedicalRecord(userid, record.aiMedicalRecord);
  validatePharmacology(userid, record.aiPharmacology, patient);
  validateHealthPlan(userid, record.aiHealthPlan);
  if (normalize(record.monitoringIndicators).split(/\r?\n/).filter(Boolean).length < 4) throw new Error(`${userid}的建议监测指标必须至少4行`);
  for (const [key, label] of [["lifestyleAvoid", "生活方式建议_必须避免"], ["lifestyleRecommend", "生活方式建议_建议执行"]]) {
    if (countLinesStarting(record[key], "•") < 4) throw new Error(`${userid}的${label}必须包含至少4个•分项`);
  }
  if (countLinesStarting(record.followupPlan, "•") < 2) throw new Error(`${userid}的复诊计划必须包含至少2个•分项`);
  if (countLinesStarting(record.emergencyReminder, "⚠") < 4) throw new Error(`${userid}的紧急就医提醒必须包含至少4个⚠分项`);

  for (const medication of patient.combinedMedication) {
    if (!record.treatmentPlan.includes(medication)) throw new Error(`${userid}的治疗方案遗漏联合用药：${medication}`);
    if (!record.aiPharmacology.includes(medication)) throw new Error(`${userid}的药理科普遗漏联合用药：${medication}`);
  }
  const treatmentNames = parseTreatmentItemNames(record.treatmentPlan);
  const allowedNames = new Set([...patient.combinedMedication, ...(patient.surgeryName ? [patient.surgeryName] : [])]);
  const expectedCount = allowedNames.size;
  if (treatmentNames.length !== expectedCount) throw new Error(`${userid}的治疗方案项目数量必须与输入已有药物和手术一致`);
  for (const name of treatmentNames) if (!allowedNames.has(name)) throw new Error(`${userid}的治疗方案含输入之外的药物或手术：${name}`);
  if (countLinesStarting(record.treatmentPlan, "——【") !== treatmentNames.length) throw new Error(`${userid}的治疗方案每个项目必须配有——【分类·作用】`);
}

const args = parseArgs(process.argv.slice(2));
if (path.resolve(args.input) === path.resolve(args.output)) throw new Error("不得覆盖输入文件");
const sourceWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(args.input));
const templateWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(args.template));
const sourceRows = sourceWorkbook.worksheets.getItemAt(0).getUsedRange(true).values;
const sourceHeaders = sourceRows[0].map(normalize);
if (JSON.stringify(sourceHeaders) !== JSON.stringify(inputHeaders)) throw new Error("审核后患者明细必须使用固定17列表头及顺序");
const templateSheet = templateWorkbook.worksheets.getItemAt(0);
const templateHeaders = templateSheet.getRange("A1:M1").values[0].map(normalize);
if (JSON.stringify(templateHeaders) !== JSON.stringify(outputHeaders)) throw new Error("健康管理方案模板必须使用固定13列表头");
const indexes = Object.fromEntries(sourceHeaders.map((header, index) => [header, index]));
const patientRows = sourceRows.slice(1).filter((row) => row.some((value) => normalize(value)));
const patients = patientRows.map((row) => {
  const userid = normalize(row[indexes.userid]);
  return {
    userid,
    disease: normalize(row[indexes["疾病"]]),
    combinedMedication: normalize(row[indexes["联合用药"]]).split("+").map(normalize).filter(Boolean),
    surgeryName: normalize(row[indexes["手术名称"]]),
    coursePlanName: normalize(row[indexes["全病程方案名称"]]),
  };
});
if (new Set(patients.map(({ userid }) => userid)).size !== patients.length) throw new Error("审核后患者明细存在重复userid");

const records = JSON.parse(await fs.readFile(args.records, "utf8"));
if (!Array.isArray(records)) throw new Error("records文件必须是JSON数组");
if (records.length !== patients.length) throw new Error("生成记录数量与患者数量不一致");
const recordByUserid = new Map();
for (const record of records) {
  if (recordByUserid.has(record.userid)) throw new Error(`重复userid：${record.userid}`);
  recordByUserid.set(record.userid, record);
}

const outputRows = patients.map((patient) => {
  const record = recordByUserid.get(patient.userid);
  if (!record) throw new Error(`缺少userid记录：${patient.userid}`);
  validateRecord(record, patient);
  return [
    record.userid, record.aiManagerIntro, record.aiMedicalRecord, record.treatmentPlan, record.aiPharmacology,
    record.aiHealthPlan, record.monitoringIndicators, record.lifestyleAvoid, record.lifestyleRecommend,
    record.followupPlan, record.emergencyReminder, "已生成", "待审核",
  ];
});

const existingRows = templateSheet.getUsedRange(true).values.length;
if (existingRows > 1) templateSheet.getRange(`A2:M${existingRows}`).clear({ applyTo: "contents" });
if (outputRows.length + 1 > existingRows) {
  const styleSource = templateSheet.getRange(`A${existingRows}:M${existingRows}`);
  for (let rowNumber = existingRows + 1; rowNumber <= outputRows.length + 1; rowNumber += 1) {
    templateSheet.getRange(`A${rowNumber}:M${rowNumber}`).copyFrom(styleSource, "all");
  }
}
templateSheet.getRangeByIndexes(1, 0, outputRows.length, outputHeaders.length).values = outputRows;
const contentRange = templateSheet.getRange(`A2:M${outputRows.length + 1}`);
contentRange.format.wrapText = true;
contentRange.format.verticalAlignment = "top";
contentRange.format.autofitRows();
templateSheet.freezePanes.freezeRows(1);
templateSheet.showGridLines = false;
for (const table of [...(templateSheet.tables.items ?? [])]) table.delete();
templateSheet.tables.add(`A1:M${outputRows.length + 1}`, true, "PatientHealthManagementPlan");

await fs.mkdir(path.dirname(args.output), { recursive: true });
await (await SpreadsheetFile.exportXlsx(templateWorkbook)).save(args.output);

if (args.preview) {
  const preview = await templateWorkbook.render({
    sheetName: templateSheet.name,
    range: `A1:M${Math.min(outputRows.length + 1, 8)}`,
    scale: 1,
    format: "png",
  });
  await fs.mkdir(path.dirname(args.preview), { recursive: true });
  await fs.writeFile(args.preview, new Uint8Array(await preview.arrayBuffer()));
}

console.log(JSON.stringify({ status: "passed", output: args.output, patients: outputRows.length, fields: outputHeaders.length }));
