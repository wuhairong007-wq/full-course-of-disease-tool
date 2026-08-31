import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import { validateAdverseReactionRecord } from "./adverse_reaction_validation.mjs";
import { generateAdverseReactionTime } from "./adverse_reaction_time.mjs";
import { validateGeneratedContent } from "./generated_content_validator.mjs";
import { normalizeAdverseReactionLevel } from "./adverse_reaction_level.mjs";

const nodeModules = process.env.CODEX_NODE_MODULES;
if (!nodeModules) throw new Error("缺少环境变量CODEX_NODE_MODULES；请使用load_workspace_dependencies返回的Node.js packages路径");
const runtimeRequire = createRequire(path.join(nodeModules, "package.json"));
const artifactToolPath = runtimeRequire.resolve("@oai/artifact-tool");
const { FileBlob, SpreadsheetFile } = await import(pathToFileURL(artifactToolPath).href);

const inputHeaders = [
  "序号", "userid", "患者姓名", "激活时间", "性别", "年龄", "疾病", "手机号码", "地区",
  "患者标签", "既往过敏史", "联合用药", "处方清单", "手术名称", "全病程方案名称", "AI状态", "确认状态",
];
const outputHeaders = ["序号", "患者ID", "疾病", "不良反应发生时间", "不良反应症状描述", "不良反应严重程度分级", "处理措施", "处理结果/转归", "是否触发人工干预", "备注"];
const normalize = (value) => String(value ?? "").trim();

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`无效参数：${key ?? ""}`);
    args[key.slice(2)] = value;
  }
  for (const required of ["input", "records", "count", "template", "output"]) if (!args[required]) throw new Error(`缺少参数：--${required}`);
  return args;
}
function parseCount(value) {
  if (!/^[1-9]\d*$/.test(normalize(value))) throw new Error("数量必须为正整数");
  return Number(value);
}
function parseDateTime(value, label) {
  const text = normalize(value);
  const match = text.match(/^(\d{4})[-\/]([01]?\d)[-\/]([0-3]?\d)(?:[ T]([0-2]?\d):([0-5]\d)(?::([0-5]\d))?)?$/);
  if (!match) throw new Error(`${label}格式无效，应为YYYY-MM-DD HH:mm:ss`);
  const [year, month, day, hour, minute, second] = [match[1], match[2], match[3], match[4] ?? "0", match[5] ?? "0", match[6] ?? "0"].map(Number);
  const date = new Date(year, month - 1, day, hour, minute, second);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute || date.getSeconds() !== second) throw new Error(`${label}不是有效时间`);
  return date;
}
const args = parseArgs(process.argv.slice(2));
const count = parseCount(args.count);
if (path.resolve(args.input) === path.resolve(args.output)) throw new Error("不得覆盖输入文件");
const sourceWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(args.input));
const templateWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(args.template));
const sourceRows = sourceWorkbook.worksheets.getItemAt(0).getUsedRange(true).values;
const headers = sourceRows[0].map(normalize);
if (JSON.stringify(headers) !== JSON.stringify(inputHeaders)) throw new Error("不良反应清单输入必须使用固定17列表头及顺序");
const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));
const patients = sourceRows.slice(1).filter((row) => row.some((value) => normalize(value))).map((row) => ({
  userid: normalize(row[indexes.userid]),
  activateTime: normalize(row[indexes["激活时间"]]),
  diseaseName: normalize(row[indexes["疾病"]]),
  adverseReactionLevel: normalizeAdverseReactionLevel(row[indexes["患者标签"]]),
  allergyHistory: normalize(row[indexes["既往过敏史"]]) || "无",
  combinedMedication: normalize(row[indexes["联合用药"]]),
  prescriptionList: normalize(row[indexes["处方清单"]]),
  surgeryName: normalize(row[indexes["手术名称"]]),
  coursePlanName: normalize(row[indexes["全病程方案名称"]]),
})).filter((patient) => ["中度", "高度"].includes(patient.adverseReactionLevel));
if (patients.length < count) throw new Error(`符合条件的中度或高度患者仅${patients.length}位，少于请求数量${count}`);
const selected = patients.slice(0, count);

const records = JSON.parse(await fs.readFile(args.records, "utf8"));
if (!Array.isArray(records)) throw new Error("records文件必须是JSON数组");
if (records.length !== selected.length) throw new Error("生成记录数量与请求数量不一致");
const recordByUserid = new Map();
for (const record of records) {
  if (recordByUserid.has(record.userid)) throw new Error(`重复userid：${record.userid}`);
  recordByUserid.set(record.userid, record);
}

const outputRows = selected.map((patient, index) => {
  const record = recordByUserid.get(patient.userid);
  if (!record) throw new Error(`缺少userid记录：${patient.userid}`);
  validateAdverseReactionRecord(record, patient);
  validateGeneratedContent({
    userid: patient.userid,
    fields: {
      symptomDescription: record.symptomDescription,
      treatmentMeasures: record.treatmentMeasures,
      outcome: record.outcome,
      remarks: record.remarks,
    },
  });
  return [
    index + 1,
    patient.userid,
    patient.diseaseName,
    generateAdverseReactionTime(patient),
    record.symptomDescription,
    patient.adverseReactionLevel,
    record.treatmentMeasures,
    record.outcome,
    patient.adverseReactionLevel === "高度" ? "是" : "否",
    record.remarks,
  ];
});

const sheet = templateWorkbook.worksheets.getItemAt(0);
if (JSON.stringify(sheet.getRange("A1:J1").values[0].map(normalize)) !== JSON.stringify(outputHeaders)) throw new Error("不良反应清单模板必须使用固定10列表头");
const existingRows = sheet.getUsedRange(true).values.length;
if (existingRows > 1) sheet.getRangeByIndexes(1, 0, existingRows - 1, outputHeaders.length).clear({ applyTo: "contents" });
if (outputRows.length + 1 > existingRows) {
  const styleSource = sheet.getRangeByIndexes(Math.max(existingRows - 1, 1), 0, 1, outputHeaders.length);
  for (let rowIndex = existingRows; rowIndex < outputRows.length + 1; rowIndex += 1) sheet.getRangeByIndexes(rowIndex, 0, 1, outputHeaders.length).copyFrom(styleSource, "all");
}
sheet.getRangeByIndexes(1, 0, outputRows.length, outputHeaders.length).values = outputRows;
const contentRange = sheet.getRangeByIndexes(1, 0, outputRows.length, outputHeaders.length);
contentRange.format.wrapText = true;
contentRange.format.verticalAlignment = "top";
contentRange.format.autofitRows();
sheet.freezePanes.freezeRows(1);
sheet.showGridLines = false;
for (const table of [...(sheet.tables.items ?? [])]) table.delete();
sheet.tables.add(`A1:J${outputRows.length + 1}`, true, "PatientAdverseReactionList");

await fs.mkdir(path.dirname(args.output), { recursive: true });
await (await SpreadsheetFile.exportXlsx(templateWorkbook)).save(args.output);
if (args.preview) {
  const preview = await templateWorkbook.render({ sheetName: sheet.name, range: `A1:J${Math.min(outputRows.length + 1, 8)}`, scale: 1, format: "png" });
  await fs.mkdir(path.dirname(args.preview), { recursive: true });
  await fs.writeFile(args.preview, new Uint8Array(await preview.arrayBuffer()));
}
console.log(JSON.stringify({ status: "passed", output: args.output, patients: outputRows.length, fields: outputHeaders.length }));
