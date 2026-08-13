import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { generateMedicationConfirmationTime } from "./medication_confirmation_time.mjs";

const nodeModules = process.env.CODEX_NODE_MODULES;
if (!nodeModules) throw new Error("缺少环境变量CODEX_NODE_MODULES；请使用load_workspace_dependencies返回的Node.js packages路径");
const runtimeRequire = createRequire(path.join(nodeModules, "package.json"));
const artifactToolPath = runtimeRequire.resolve("@oai/artifact-tool");
const { FileBlob, SpreadsheetFile } = await import(pathToFileURL(artifactToolPath).href);

const sourceHeaders = [
  "序号", "userid", "患者姓名", "激活时间", "性别", "年龄", "疾病", "手机号码", "地区",
  "患者标签", "既往过敏史", "联合用药", "处方清单", "手术名称", "全病程方案名称", "AI状态", "确认状态",
];
const trackingHeaders = [
  "序号", "患者ID", "姓名", "性别", "年龄", "疾病", "既往过敏史", "联合用药", "体温监测次数",
  "血压、心率监测次数", "用药提醒次数", "用药方案", "用药周期", "方案链接", "患者响应率", "是否触发人工干预",
];
const medicationHeaders = ["userid", "用药方案确认时间", "药品名称", "规格", "单次剂量", "用药频率", "用药时间", "疗程天数", "注意事项"];
const recordKeys = ["userid", "medicationPlan", "medicationCycle", "medicationItems"];
const itemKeys = ["drugName", "specification", "singleDose", "frequency", "medicationTime", "treatmentDays", "precautions"];
const allowedMedicationTime = /^(?:早餐前|早餐后|午餐前|午餐后|晚餐前|晚餐后|晚餐中|餐前|餐中|餐后(?:\d+(?:\.\d+)?小时)?|晨起空腹|睡前|早晚|早中晚|固定时间|按\d+小时等间隔)$/;
const latinFrequency = /\b(?:qd|bid|tid|qid|q\d+h|prn)\b/i;
const activateDatePattern = /\d{4}[-年\/]\d{1,2}[-月\/]\d{1,2}/;
const activationAnchorPattern = /(?:从|以|自)?(?:激活|启用)(?:日期|时间|当日|当天|日|时)?[^。；，]{0,12}(?:起点|算起|开始|起|后|之日起|第\d+天|锚点)/;

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`无效参数：${key ?? ""}`);
    args[key.slice(2)] = value;
  }
  for (const required of ["input", "records", "tracking-template", "medication-template", "tracking-output", "medication-output"]) {
    if (!args[required]) throw new Error(`缺少参数：--${required}`);
  }
  if (!args["service-start"] || !args["service-end"]) throw new Error("缺少服务周期参数：--service-start和--service-end");
  return args;
}

const normalize = (value) => String(value ?? "").trim();
function parseCalendarDate(value, label) {
  const text = normalize(value);
  const match = text.match(/^(\d{4})[-\/]([01]?\d)[-\/]([0-3]?\d)(?:[ T].*)?$/);
  if (!match) throw new Error(`${label}格式无效，应为YYYY-MM-DD`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) throw new Error(`${label}不是有效日期`);
  return { text, dayNumber: Math.floor(date.getTime() / 86400000) };
}

function stableRandom(userid, salt) {
  let hash = 2166136261;
  const input = `${userid}|${salt}`;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

const randomBetween = (userid, salt, minimum, maximum) => minimum + stableRandom(userid, salt) * (maximum - minimum);
const randomInteger = (userid, salt, minimum, maximum) => minimum + Math.floor(stableRandom(userid, salt) * (maximum - minimum + 1));

function trackingMetrics(patient) {
  const activateDate = parseCalendarDate(patient.activateDate, `${patient.userid}的激活时间`);
  const serviceEndDate = parseCalendarDate(patient.serviceEndDate, `${patient.userid}的服务结束日期`);
  const days = Math.max(serviceEndDate.dayNumber - activateDate.dayNumber + 1, 1);
  const periodSalt = `${patient.serviceStartDate}|${patient.serviceEndDate}`;
  return {
    temperature: Math.round(2 * days * randomBetween(patient.userid, `${periodSalt}|temperature`, 0.4, 0.9)),
    bloodPressureHeartRate: Math.round(days * randomBetween(patient.userid, `${periodSalt}|blood-pressure-heart-rate`, 0.5, 0.85)),
    medicationReminder: Math.round(3 * days * randomBetween(patient.userid, `${periodSalt}|medication-reminder`, 0.6, 0.85)),
    patientResponseRate: randomInteger(patient.userid, `${periodSalt}|patient-response-rate`, 45, 70),
    manualIntervention: ["中度", "高度"].includes(patient.adverseReactionLevel) ? "是" : "否",
  };
}
const isTreatmentDaysValid = (value) => {
  if (Number.isInteger(value) && value > 0) return true;
  const text = normalize(value);
  return /^[1-9]\d*$/.test(text) || ["长期", "无限期"].includes(text);
};

function getPrescriptionSegment(prescriptionList, medication, nextMedication) {
  const start = prescriptionList.indexOf(medication);
  if (start < 0) return "";
  const next = nextMedication ? prescriptionList.indexOf(nextMedication, start + medication.length) : -1;
  return prescriptionList.slice(start, next < 0 ? undefined : next);
}

function getExpectedTreatmentDays(segment) {
  const finite = segment.match(/(?:连续|疗程(?:为|共)?|使用)(\d+)天/);
  if (finite) return Number(finite[1]);
  if (/无限期/.test(segment)) return "无限期";
  if (/长期|长期维持|持续用药/.test(segment)) return "长期";
  return null;
}

function getReviewedField(segment, pattern) {
  return normalize(segment.match(pattern)?.[1]);
}

function validateRecord(record, patient) {
  const userid = patient.userid;
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`${userid}记录必须为对象`);
  if (JSON.stringify(Object.keys(record)) !== JSON.stringify(recordKeys)) throw new Error(`${userid}必须且只能依次包含4个用药方案字段`);
  if (record.userid !== userid) throw new Error(`${userid}的userid被改变`);
  if (!normalize(record.medicationPlan)) throw new Error(`${userid}的medicationPlan不能为空`);
  if (!normalize(record.medicationCycle)) throw new Error(`${userid}的medicationCycle不能为空`);
  if (activateDatePattern.test(record.medicationCycle) || (patient.activateDate && record.medicationCycle.includes(patient.activateDate))) {
    throw new Error(`${userid}的medicationCycle不得依据激活日期推算或包含激活日期`);
  }
  if (activationAnchorPattern.test(record.medicationCycle)) throw new Error(`${userid}的medicationCycle不得以激活时间为周期锚点`);
  if (!record.medicationPlan.includes(patient.diseaseName)) throw new Error(`${userid}的medicationPlan必须体现疾病`);
  if (!record.medicationPlan.includes(String(patient.age))) throw new Error(`${userid}的medicationPlan必须体现年龄`);
  if (patient.gender && !record.medicationPlan.includes(patient.gender)) throw new Error(`${userid}的medicationPlan必须体现性别`);
  for (const medication of patient.combinedMedication) {
    if (!record.medicationPlan.includes(medication)) throw new Error(`${userid}的medicationPlan遗漏联合用药：${medication}`);
    if (patient.treatmentPlan && !patient.treatmentPlan.includes(medication)) throw new Error(`${userid}的治疗方案遗漏联合用药：${medication}`);
  }
  if (!Array.isArray(record.medicationItems)) throw new Error(`${userid}的medicationItems必须为数组`);
  if (record.medicationItems.length !== patient.combinedMedication.length) throw new Error(`${userid}的medicationItems数量必须与联合用药一致`);
  const names = record.medicationItems.map((item) => item?.drugName);
  if (JSON.stringify(names) !== JSON.stringify(patient.combinedMedication)) throw new Error(`${userid}的medicationItems必须与联合用药同序一一对应`);
  if (new Set(names).size !== names.length) throw new Error(`${userid}的medicationItems存在重复药品`);
  for (let itemIndex = 0; itemIndex < record.medicationItems.length; itemIndex += 1) {
    const item = record.medicationItems[itemIndex];
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new Error(`${userid}的用药项目必须为对象`);
    if (JSON.stringify(Object.keys(item)) !== JSON.stringify(itemKeys)) throw new Error(`${userid}的每个用药项目必须且只能依次包含7个字段`);
    for (const key of itemKeys) if (!normalize(item[key])) throw new Error(`${userid}的${item.drugName || "用药项目"}.${key}不能为空`);
    if (!patient.prescriptionList.includes(item.drugName)) throw new Error(`${userid}含处方清单之外的药物：${item.drugName}`);
    if (latinFrequency.test(item.frequency) || !/^(?:每日[1-9]\d*次|每[1-9]\d*小时1次|每周[1-9]\d*次|隔日1次)$/.test(item.frequency)) {
      throw new Error(`${userid}的${item.drugName}用药频率必须使用中文量化格式`);
    }
    if (!allowedMedicationTime.test(item.medicationTime)) throw new Error(`${userid}的${item.drugName}用药时间必须仅包含规范服药时机`);
    if (!isTreatmentDaysValid(item.treatmentDays)) throw new Error(`${userid}的${item.drugName}疗程天数格式无效`);
    const segment = getPrescriptionSegment(patient.prescriptionList, item.drugName, patient.combinedMedication[itemIndex + 1]);
    const expectedTreatmentDays = getExpectedTreatmentDays(segment);
    if (expectedTreatmentDays === null) throw new Error(`${userid}的${item.drugName}处方未提供可验证疗程`);
    const actualTreatmentDays = /^[1-9]\d*$/.test(normalize(item.treatmentDays)) ? Number(item.treatmentDays) : item.treatmentDays;
    if (actualTreatmentDays !== expectedTreatmentDays) throw new Error(`${userid}的${item.drugName}疗程必须与审核处方一致`);
    const expectedFrequency = segment.match(/(?:每日[1-9]\d*次|每[1-9]\d*小时1次|每周[1-9]\d*次|隔日1次)/)?.[0];
    if (!expectedFrequency || item.frequency !== expectedFrequency) throw new Error(`${userid}的${item.drugName}频率必须与审核处方一致`);
    const expectedSpecification = getReviewedField(segment, /规格\s*([^，；+]+)/);
    const expectedSingleDose = getReviewedField(segment, /每次\s*([^，；+]+)/);
    if (!expectedSpecification || item.specification !== expectedSpecification) throw new Error(`${userid}的${item.drugName}规格必须与审核处方一致`);
    if (!expectedSingleDose || item.singleDose !== expectedSingleDose) throw new Error(`${userid}的${item.drugName}单次剂量必须与审核处方一致`);
    if (patient.allergyHistory !== "无" && !item.precautions.includes(patient.allergyHistory)) {
      throw new Error(`${userid}的${item.drugName}注意事项必须提示既往过敏史`);
    }
    if (patient.combinedMedication.length > 1 && !/(?:联合用药|相互作用)/.test(item.precautions)) {
      throw new Error(`${userid}的${item.drugName}注意事项必须提示联合用药核对或相互作用风险`);
    }
  }
}

async function extendTemplate(sheet, columns, outputRows, tableName) {
  const existingRows = sheet.getUsedRange(true).values.length;
  if (existingRows > 1) sheet.getRangeByIndexes(1, 0, existingRows - 1, columns).clear({ applyTo: "contents" });
  if (outputRows.length + 1 > existingRows) {
    const styleSource = sheet.getRangeByIndexes(Math.max(existingRows - 1, 1), 0, 1, columns);
    for (let rowIndex = existingRows; rowIndex < outputRows.length + 1; rowIndex += 1) {
      sheet.getRangeByIndexes(rowIndex, 0, 1, columns).copyFrom(styleSource, "all");
    }
  }
  sheet.getRangeByIndexes(1, 0, outputRows.length, columns).values = outputRows;
  const range = sheet.getRangeByIndexes(1, 0, outputRows.length, columns);
  range.format.wrapText = true;
  range.format.verticalAlignment = "top";
  range.format.autofitRows();
  sheet.freezePanes.freezeRows(1);
  sheet.showGridLines = false;
  for (const table of [...(sheet.tables.items ?? [])]) table.delete();
  sheet.tables.add(sheet.getRangeByIndexes(0, 0, outputRows.length + 1, columns).address, true, tableName);
}

const args = parseArgs(process.argv.slice(2));
const serviceStartDate = parseCalendarDate(args["service-start"], "服务周期开始日期");
const serviceEndDate = parseCalendarDate(args["service-end"], "服务周期结束日期");
if (serviceStartDate.dayNumber > serviceEndDate.dayNumber) throw new Error("服务周期开始日期不得晚于结束日期");
for (const output of [args["tracking-output"], args["medication-output"]]) {
  if (path.resolve(args.input) === path.resolve(output)) throw new Error("不得覆盖输入文件");
}
const sourceWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(args.input));
const sourceRows = sourceWorkbook.worksheets.getItemAt(0).getUsedRange(true).values;
const actualSourceHeaders = sourceRows[0].map(normalize);
if (JSON.stringify(actualSourceHeaders) !== JSON.stringify(sourceHeaders)) throw new Error("跟踪提醒输入必须使用固定17列表头及顺序");
const indexes = Object.fromEntries(actualSourceHeaders.map((header, index) => [header, index]));
const patients = sourceRows.slice(1).filter((row) => row.some((value) => normalize(value))).map((row) => {
  const userid = normalize(row[indexes.userid]);
  const adverseReactionLevel = normalize(row[indexes["患者标签"]]);
  if (!["轻度", "中度", "高度"].includes(adverseReactionLevel)) throw new Error(`${userid}的不良反应分层必须为轻度、中度或高度`);
  return {
  userid,
  patientName: normalize(row[indexes["患者姓名"]]),
  activateDate: normalize(row[indexes["激活时间"]]),
  gender: normalize(row[indexes["性别"]]),
  age: Number(row[indexes["年龄"]]),
  diseaseName: normalize(row[indexes["疾病"]]),
  allergyHistory: normalize(row[indexes["既往过敏史"]]) || "无",
  combinedMedication: normalize(row[indexes["联合用药"]]).split("+").map(normalize).filter(Boolean),
  prescriptionList: normalize(row[indexes["处方清单"]]),
  treatmentPlan: "",
  serviceStartDate: serviceStartDate.text,
  serviceEndDate: serviceEndDate.text,
  adverseReactionLevel,
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

const trackingRows = [];
const medicationRows = [];
for (let index = 0; index < patients.length; index += 1) {
  const patient = patients[index];
  const record = recordByUserid.get(patient.userid);
  if (!record) throw new Error(`缺少userid记录：${patient.userid}`);
  validateRecord(record, patient);
  const metrics = trackingMetrics(patient);
  trackingRows.push([
    index + 1, patient.userid, patient.patientName, patient.gender, patient.age, patient.diseaseName,
    patient.allergyHistory, patient.combinedMedication.join("+"), metrics.temperature, metrics.bloodPressureHeartRate,
    metrics.medicationReminder, record.medicationPlan, record.medicationCycle, "", metrics.patientResponseRate,
    metrics.manualIntervention,
  ]);
  const medicationConfirmationTime = generateMedicationConfirmationTime({ userid: patient.userid, activateTime: patient.activateDate });
  for (const item of record.medicationItems) {
    const treatmentDays = /^[1-9]\d*$/.test(normalize(item.treatmentDays)) ? Number(item.treatmentDays) : item.treatmentDays;
    medicationRows.push([
      patient.userid, medicationConfirmationTime, item.drugName, item.specification, item.singleDose,
      item.frequency, item.medicationTime, treatmentDays, item.precautions,
    ]);
  }
}

const trackingWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(args["tracking-template"]));
const trackingSheet = trackingWorkbook.worksheets.getItemAt(0);
if (JSON.stringify(trackingSheet.getRange("A1:P1").values[0].map(normalize)) !== JSON.stringify(trackingHeaders)) {
  throw new Error("跟踪提醒模板必须使用固定16列表头");
}
await extendTemplate(trackingSheet, trackingHeaders.length, trackingRows, "PatientMedicationTracking");

const medicationWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(args["medication-template"]));
const medicationSheet = medicationWorkbook.worksheets.getItemAt(0);
if (JSON.stringify(medicationSheet.getRange("A1:I1").values[0].map(normalize)) !== JSON.stringify(medicationHeaders)) {
  throw new Error("用药清单模板必须使用固定9列表头");
}
await extendTemplate(medicationSheet, medicationHeaders.length, medicationRows, "PatientMedicationList");

for (const output of [args["tracking-output"], args["medication-output"]]) await fs.mkdir(path.dirname(output), { recursive: true });
await (await SpreadsheetFile.exportXlsx(trackingWorkbook)).save(args["tracking-output"]);
await (await SpreadsheetFile.exportXlsx(medicationWorkbook)).save(args["medication-output"]);

if (args["tracking-preview"]) {
  const preview = await trackingWorkbook.render({ sheetName: trackingSheet.name, range: `A1:P${Math.min(trackingRows.length + 1, 8)}`, scale: 1, format: "png" });
  await fs.mkdir(path.dirname(args["tracking-preview"]), { recursive: true });
  await fs.writeFile(args["tracking-preview"], new Uint8Array(await preview.arrayBuffer()));
}
if (args["medication-preview"]) {
  const preview = await medicationWorkbook.render({ sheetName: medicationSheet.name, range: `A1:I${Math.min(medicationRows.length + 1, 12)}`, scale: 1, format: "png" });
  await fs.mkdir(path.dirname(args["medication-preview"]), { recursive: true });
  await fs.writeFile(args["medication-preview"], new Uint8Array(await preview.arrayBuffer()));
}

console.log(JSON.stringify({ status: "passed", patients: patients.length, medicationItems: medicationRows.length, trackingOutput: args["tracking-output"], medicationOutput: args["medication-output"] }));
