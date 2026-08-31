import fs from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const nodeModules = process.env.CODEX_NODE_MODULES;
if (!nodeModules) throw new Error("缺少环境变量CODEX_NODE_MODULES；请使用load_workspace_dependencies返回的Node.js packages路径");
const runtimeRequire = createRequire(path.join(nodeModules, "package.json"));
const artifactToolPath = runtimeRequire.resolve("@oai/artifact-tool");
const { FileBlob, SpreadsheetFile } = await import(pathToFileURL(artifactToolPath).href);

const requiredHeaders = [
  "序号", "userid", "患者姓名", "激活时间", "性别", "年龄", "疾病", "手机号码", "地区",
  "患者标签", "既往过敏史", "联合用药", "处方清单", "手术名称", "全病程方案名称", "AI状态", "确认状态",
];

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

const normalize = (value) => String(value ?? "").trim();

const args = parseArgs(process.argv.slice(2));
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(args.input));
const rows = workbook.worksheets.getItemAt(0).getUsedRange(true).values;
if (!rows.length) throw new Error("审核后患者明细为空");
const headers = rows[0].map(normalize);
if (JSON.stringify(headers) !== JSON.stringify(requiredHeaders)) throw new Error("审核后患者明细必须使用固定17列表头及顺序");
const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));

const patients = [];
for (const row of rows.slice(1)) {
  if (row.every((value) => !normalize(value))) continue;
  const userid = normalize(row[indexes.userid]);
  const age = Number(row[indexes["年龄"]]);
  const disease = normalize(row[indexes["疾病"]]);
  const coursePlanName = normalize(row[indexes["全病程方案名称"]]);
  const combinedMedication = normalize(row[indexes["联合用药"]]).split("+").map(normalize).filter(Boolean);
  if (!userid) throw new Error("审核后患者明细存在空userid");
  if (!Number.isFinite(age) || age < 0 || age > 130) throw new Error(`${userid}存在无效年龄`);
  if (!disease) throw new Error(`${userid}的疾病不能为空`);
  if (!coursePlanName) throw new Error(`${userid}的全病程方案名称不能为空`);
  if (!combinedMedication.length) throw new Error(`${userid}的联合用药不能为空`);
  if (new Set(combinedMedication).size !== combinedMedication.length) throw new Error(`${userid}的联合用药存在重复`);
  patients.push({
    userid,
    activateTime: normalize(row[indexes["激活时间"]]),
    gender: normalize(row[indexes["性别"]]),
    age,
    disease,
    allergyHistory: normalize(row[indexes["既往过敏史"]]) || "无",
    combinedMedication,
    prescriptionList: normalize(row[indexes["处方清单"]]),
    surgeryName: normalize(row[indexes["手术名称"]]),
    coursePlanName,
  });
}

if (!patients.length) throw new Error("审核后患者明细没有患者数据");
if (new Set(patients.map(({ userid }) => userid)).size !== patients.length) throw new Error("审核后患者明细存在重复userid");

await fs.mkdir(path.dirname(args.output), { recursive: true });
await fs.writeFile(args.output, JSON.stringify(patients, null, 2), "utf8");
console.log(JSON.stringify({ status: "passed", output: args.output, patients: patients.length }));
