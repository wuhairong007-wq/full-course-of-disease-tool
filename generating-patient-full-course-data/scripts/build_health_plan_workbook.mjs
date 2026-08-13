import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

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
  if (/(?:主诉|体征)[：:].*(?:\d+(?:\.\d+)?\s*(?:℃|次\/分|mmHg|%|bpm)|T\s*\d|P\s*\d|BP\s*\d|SpO2)/i.test(text)) {
    throw new Error(`${userid}的AI病历解读不得虚构主诉、体征或生命体征数值`);
  }
  for (const required of ["就诊科室：", "就诊日期：", "主诉：源文件未提供", "体征：源文件未提供", "处置："]) {
    if (!text.includes(required)) throw new Error(`${userid}的AI病历解读缺少：${required}`);
  }
}

function validateRecord(record, patient) {
  const userid = patient.userid;
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`${userid}记录必须为对象`);
  if (JSON.stringify(Object.keys(record)) !== JSON.stringify(recordKeys)) throw new Error(`${userid}必须且只能依次包含11个健康方案字段`);
  if (record.userid !== userid) throw new Error(`${userid}的userid被改变`);
  for (const key of contentKeys) if (!normalize(record[key])) throw new Error(`${userid}的${key}不能为空`);
  validateMedicalRecord(userid, record.aiMedicalRecord);
  if (!/[①一].*[②二].*[③三]/s.test(record.aiHealthPlan)) throw new Error(`${userid}的AI健康管理方案必须至少包含①②③`);
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
    combinedMedication: normalize(row[indexes["联合用药"]]).split("+").map(normalize).filter(Boolean),
    surgeryName: normalize(row[indexes["手术名称"]]),
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
