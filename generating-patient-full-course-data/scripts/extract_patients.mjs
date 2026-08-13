import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const nodeModules = process.env.CODEX_NODE_MODULES;
if (!nodeModules) throw new Error("缺少环境变量CODEX_NODE_MODULES；请使用load_workspace_dependencies返回的Node.js packages路径");
const runtimeRequire = createRequire(path.join(nodeModules, "package.json"));
const artifactToolPath = runtimeRequire.resolve("@oai/artifact-tool");
const { FileBlob, SpreadsheetFile } = await import(pathToFileURL(artifactToolPath).href);

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
const patients = rows.slice(1).map((row) => Object.fromEntries(fields.map(([outputKey, sourceHeader]) => {
  const value = row[indexes[sourceHeader]];
  if (outputKey === "age") return [outputKey, Number(value)];
  const normalized = String(value ?? "").trim();
  return [outputKey, outputKey === "allergyHistory" ? normalized || "无" : normalized];
})));

if (patients.some((patient) => !patient.userid || !Number.isFinite(patient.age))) throw new Error("基础数据存在空userid或无效年龄");
if (new Set(patients.map((patient) => patient.userid)).size !== patients.length) throw new Error("基础数据存在重复userid");

await fs.mkdir(path.dirname(args.output), { recursive: true });
await fs.writeFile(args.output, JSON.stringify(patients, null, 2), "utf8");
console.log(JSON.stringify({ status: "passed", output: args.output, patients: patients.length }));
