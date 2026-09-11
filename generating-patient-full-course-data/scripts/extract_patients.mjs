import fs from "node:fs/promises";
import path from "node:path";
import { loadArtifactTool } from "./lib/artifact_tool.mjs";

const { FileBlob, SpreadsheetFile } = await loadArtifactTool();

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`无效参数：${key ?? ""}`);
    args[key.slice(2)] = value;
  }
  if (!args.input) throw new Error("缺少参数：--input");
  if (!args.output) throw new Error("缺少参数：--output");
  return args;
}

const fields = [
  ["userid", "userid"],
  ["activateTime", "激活时间"],
  ["gender", "性别"],
  ["age", "年龄"],
  ["disease", "疾病"],
  ["productName", "产品名称"],
  ["productType", "产品类型"],
  ["allergyHistory", "既往过敏史"],
];

const args = parseArgs(process.argv.slice(2));
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(args.input));
const rows = workbook.worksheets.getItemAt(0).getUsedRange(true).values;
const headers = rows[0].map((value) => String(value ?? "").trim());
for (const [, sourceHeader] of fields) {
  if (!headers.includes(sourceHeader)) throw new Error(`基础数据缺少必需字段：${sourceHeader}`);
}

const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));
const symptomHeaders = [
  "疼痛程度", "疼痛评分", "炎症表现", "症状", "症状描述", "主诉",
  "症状持续时间", "晨僵时间", "关节肿胀", "活动受限",
];
const clinicalHeaders = [
  "合并疾病", "既往病史", "当前用药", "用药效果", "肝功能", "肾功能", "妊娠状态", "哺乳状态", "手术史",
];
const patients = rows.slice(1).map((row) => Object.fromEntries(fields.map(([outputKey, sourceHeader]) => {
  const value = row[indexes[sourceHeader]];
  if (outputKey === "age") return [outputKey, Number(value)];
  const normalized = String(value ?? "").trim();
  return [outputKey, outputKey === "allergyHistory" ? normalized || "无" : normalized];
})));

patients.forEach((patient, index) => {
  const row = rows[index + 1];
  for (const [key, optionalHeaders] of [["symptomEvidence", symptomHeaders], ["clinicalContext", clinicalHeaders]]) {
    const evidence = Object.fromEntries(optionalHeaders
      .filter((header) => headers.includes(header))
      .map((header) => [header, String(row[indexes[header]] ?? "").trim()])
      .filter(([, value]) => value !== ""));
    if (Object.keys(evidence).length) patient[key] = evidence;
  }
});

if (patients.some((patient) => !patient.userid || !Number.isFinite(patient.age))) throw new Error("基础数据存在空userid或无效年龄");
if (new Set(patients.map((patient) => patient.userid)).size !== patients.length) throw new Error("基础数据存在重复userid");

await fs.mkdir(path.dirname(args.output), { recursive: true });
await fs.writeFile(args.output, JSON.stringify(patients, null, 2), "utf8");
console.log(JSON.stringify({ status: "passed", output: args.output, patients: patients.length }));
