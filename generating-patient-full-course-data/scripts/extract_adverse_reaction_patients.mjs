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
  for (const required of ["input", "count", "output"]) if (!args[required]) throw new Error(`缺少参数：--${required}`);
  return args;
}

const normalize = (value) => String(value ?? "").trim();
const allowedLevels = new Set(["无", "轻度", "中度", "高度"]);
const eligibleLevels = new Set(["轻度", "中度", "高度"]);
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
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute || date.getSeconds() !== second) {
    throw new Error(`${label}不是有效时间`);
  }
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")}`;
}

const args = parseArgs(process.argv.slice(2));
const count = parseCount(args.count);
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(args.input));
const rows = workbook.worksheets.getItemAt(0).getUsedRange(true).values;
if (!rows.length) throw new Error("审核后患者明细为空");
const headers = rows[0].map(normalize);
if (JSON.stringify(headers) !== JSON.stringify(requiredHeaders)) throw new Error("不良反应清单输入必须使用固定17列表头及顺序");
const indexes = Object.fromEntries(headers.map((header, index) => [header, index]));

const allUserids = new Set();
const eligible = [];
for (const row of rows.slice(1)) {
  if (row.every((value) => !normalize(value))) continue;
  const userid = normalize(row[indexes.userid]);
  const level = normalize(row[indexes["患者标签"]]);
  const diseaseName = normalize(row[indexes["疾病"]]);
  const age = Number(row[indexes["年龄"]]);
  if (!userid) throw new Error("审核后患者明细存在空userid");
  if (allUserids.has(userid)) throw new Error(`审核后患者明细存在重复userid：${userid}`);
  allUserids.add(userid);
  if (!diseaseName) throw new Error(`${userid}的疾病不能为空`);
  if (!Number.isFinite(age) || age < 0 || age > 130) throw new Error(`${userid}存在无效年龄`);
  if (!allowedLevels.has(level)) throw new Error(`${userid}的不良反应分层必须为无、轻度、中度或高度`);
  const activateTime = parseDateTime(row[indexes["激活时间"]], `${userid}的激活时间`);
  if (!eligibleLevels.has(level)) continue;
  const combinedMedication = normalize(row[indexes["联合用药"]]);
  const prescriptionList = normalize(row[indexes["处方清单"]]);
  if (!combinedMedication) throw new Error(`${userid}的联合用药不能为空`);
  if (!prescriptionList) throw new Error(`${userid}的处方清单不能为空`);
  eligible.push({
    userid,
    patientName: normalize(row[indexes["患者姓名"]]),
    activateTime,
    gender: normalize(row[indexes["性别"]]),
    age,
    diseaseName,
    adverseReactionLevel: level,
    allergyHistory: normalize(row[indexes["既往过敏史"]]) || "无",
    combinedMedication,
    prescriptionList,
    surgeryName: normalize(row[indexes["手术名称"]]),
    coursePlanName: normalize(row[indexes["全病程方案名称"]]),
  });
}
if (eligible.length < count) throw new Error(`符合条件的轻度、中度或高度患者仅${eligible.length}位，少于请求数量${count}`);
const selected = eligible.slice(0, count);
await fs.mkdir(path.dirname(args.output), { recursive: true });
await fs.writeFile(args.output, JSON.stringify(selected, null, 2), "utf8");
console.log(JSON.stringify({ status: "passed", output: args.output, eligible: eligible.length, selected: selected.length }));
