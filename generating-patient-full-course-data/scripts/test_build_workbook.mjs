import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const nodeModules = process.env.CODEX_NODE_MODULES;
if (!nodeModules) throw new Error("缺少环境变量CODEX_NODE_MODULES");
const runtimeRequire = createRequire(path.join(nodeModules, "package.json"));
const artifactToolPath = runtimeRequire.resolve("@oai/artifact-tool");
const { FileBlob, SpreadsheetFile, Workbook } = await import(pathToFileURL(artifactToolPath).href);

const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const skillDir = path.resolve(scriptDir, "..");
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "patient-course-skill-"));
const sourcePath = path.join(tempDir, "基础患者.xlsx");
const recordsPath = path.join(tempDir, "records.json");
const outputPath = path.join(tempDir, "患者全病程数据_生成.xlsx");
const extractedPath = path.join(tempDir, "patients.json");
const templatePath = path.join(skillDir, "assets", "patient-full-course-template.xlsx");

const sourceHeaders = [
  "序号", "userid", "患者姓名", "激活时间", "性别", "年龄", "疾病", "手机号码", "地区",
  "患者标签", "既往过敏史", "产品名称", "产品类型",
];
const sourceRows = [
  [1, "U001", "甲*", "2026-08-01 10:00:00", "男", 70, "心房颤动伴缓慢心室率", "130****0001", "江苏省南京市", "轻度", "无", "心脏起搏器", "器械"],
  [2, "U002", "乙*", "2026-08-02 11:00:00", "女", 42, "肥厚型梗阻性心肌病", "130****0002", "江苏省无锡市", "中度", "青霉素过敏", "心脏起搏器", "器械"],
];
const records = [
  {
    userid: "U001",
    allergyHistory: "无",
    combinedMedication: ["华法林钠片", "对乙酰氨基酚片"],
    prescriptionList: "华法林钠片 规格2.5mg/片，每次2.5mg，口服，每日1次，晚餐中服用，疗程至术后4周 + 对乙酰氨基酚片 规格0.5g/片，每次0.25g，口服，每8小时1次，餐后服用，连续3天；【术后用药阶段：心脏起搏器植入术后】",
    surgeryName: "单腔永久心脏起搏器植入术（VVI模式）",
    coursePlanName: "心房颤动伴缓慢心室率心脏起搏器术后抗凝与设备随访方案",
  },
  {
    userid: "U002",
    allergyHistory: "青霉素过敏",
    combinedMedication: ["琥珀酸美托洛尔缓释片", "对乙酰氨基酚片"],
    prescriptionList: "琥珀酸美托洛尔缓释片 规格47.5mg/片，每次23.75mg，口服，每日1次，早餐后服用，长期治疗 + 对乙酰氨基酚片 规格0.5g/片，每次0.5g，口服，每8小时1次，餐后服用，连续3天；因青霉素过敏，未选用青霉素类药物；【术后用药阶段：心脏起搏器植入术后】",
    surgeryName: "双腔永久心脏起搏器植入术（DDD模式）",
    coursePlanName: "肥厚型梗阻性心肌病心脏起搏器术后流出道梗阻管理方案",
  },
];

const sourceWorkbook = Workbook.create();
const sourceSheet = sourceWorkbook.worksheets.add("Sheet1");
sourceSheet.getRange("A1:M3").values = [sourceHeaders, ...sourceRows];
await (await SpreadsheetFile.exportXlsx(sourceWorkbook)).save(sourcePath);
await fs.writeFile(recordsPath, JSON.stringify(records, null, 2), "utf8");

const nodePath = process.execPath;
const extractResult = spawnSync(nodePath, [
  path.join(scriptDir, "extract_patients.mjs"),
  "--input", sourcePath,
  "--output", extractedPath,
], { encoding: "utf8", env: { ...process.env, CODEX_NODE_MODULES: nodeModules } });
assert.equal(extractResult.status, 0, `${extractResult.stdout}\n${extractResult.stderr}`);
const extractedPatients = JSON.parse(await fs.readFile(extractedPath, "utf8"));
assert.deepEqual(extractedPatients, [
  { userid: "U001", activateTime: "2026-08-01 10:00:00", gender: "男", age: 70, disease: "心房颤动伴缓慢心室率", productName: "心脏起搏器", productType: "器械", allergyHistory: "无" },
  { userid: "U002", activateTime: "2026-08-02 11:00:00", gender: "女", age: 42, disease: "肥厚型梗阻性心肌病", productName: "心脏起搏器", productType: "器械", allergyHistory: "青霉素过敏" },
]);

const result = spawnSync(nodePath, [
  path.join(scriptDir, "build_workbook.mjs"),
  "--input", sourcePath,
  "--records", recordsPath,
  "--template", templatePath,
  "--output", outputPath,
], { encoding: "utf8", env: { ...process.env, CODEX_NODE_MODULES: nodeModules } });

assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

const outputWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
const outputSheet = outputWorkbook.worksheets.getItemAt(0);
const outputRows = outputSheet.getUsedRange(true).values;
const expectedHeaders = [
  "序号", "userid", "患者姓名", "激活时间", "性别", "年龄", "疾病", "手机号码", "地区",
  "患者标签", "既往过敏史", "联合用药", "处方清单", "手术名称", "全病程方案名称", "AI状态", "确认状态",
];

assert.deepEqual(outputRows[0], expectedHeaders);
assert.equal(outputRows.length, 3);
assert.deepEqual(outputRows[1].slice(0, 11), sourceRows[0].slice(0, 11));
assert.deepEqual(outputRows[2].slice(0, 11), sourceRows[1].slice(0, 11));
assert.equal(outputRows[1][11], "华法林钠片+对乙酰氨基酚片");
assert.equal(outputRows[1][15], "已生成");
assert.equal(outputRows[1][16], "待确认");
assert.equal(outputSheet.tables.items.length, 1);

async function assertInvalidRecords(invalidRecords, expectedMessage) {
  await fs.writeFile(recordsPath, JSON.stringify(invalidRecords, null, 2), "utf8");
  const invalidResult = spawnSync(nodePath, [
    path.join(scriptDir, "build_workbook.mjs"),
    "--input", sourcePath,
    "--records", recordsPath,
    "--template", templatePath,
    "--output", outputPath,
  ], { encoding: "utf8", env: { ...process.env, CODEX_NODE_MODULES: nodeModules } });
  assert.notEqual(invalidResult.status, 0);
  assert.match(`${invalidResult.stdout}\n${invalidResult.stderr}`, expectedMessage);
}

await assertInvalidRecords([
  { ...records[0], combinedMedication: ["华法林钠片"], prescriptionList: "华法林钠片 规格2.5mg/片，每次2.5mg，口服，每日1次，晚餐中服用，疗程至术后4周" },
  records[1],
], /combinedMedication必须为2～5项数组/);

await assertInvalidRecords([
  {
    ...records[0],
    combinedMedication: ["药物一", "药物二", "药物三", "药物四", "药物五", "药物六"],
    prescriptionList: "药物一 规格1mg，每次1mg，口服，每日1次，早餐后服用，连续1天 + 药物二 规格2mg，每次2mg，口服，每日1次，早餐后服用，连续1天 + 药物三 规格3mg，每次3mg，口服，每日1次，早餐后服用，连续1天 + 药物四 规格4mg，每次4mg，口服，每日1次，早餐后服用，连续1天 + 药物五 规格5mg，每次5mg，口服，每日1次，早餐后服用，连续1天 + 药物六 规格6mg，每次6mg，口服，每日1次，早餐后服用，连续1天",
  },
  records[1],
], /combinedMedication必须为2～5项数组/);

await assertInvalidRecords([
  {
    ...records[0],
    prescriptionList: `${records[0].prescriptionList} + 奥美拉唑肠溶胶囊 规格20mg/粒，每次20mg，口服，每日1次，早餐前服用，连续7天`,
  },
  records[1],
], /处方清单必须与联合用药按顺序一一对应/);

await assertInvalidRecords([
  {
    ...records[0],
    prescriptionList: "对乙酰氨基酚片 规格0.5g/片，每次0.25g，口服，每8小时1次，餐后服用，连续3天 + 华法林钠片 规格2.5mg/片，每次2.5mg，口服，每日1次，晚餐中服用，疗程至术后4周",
  },
  records[1],
], /处方清单必须与联合用药按顺序一一对应/);

console.log(JSON.stringify({ status: "passed", rows: outputRows.length, columns: outputRows[0].length }));
