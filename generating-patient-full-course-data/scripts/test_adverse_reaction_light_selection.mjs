import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { loadArtifactTool } from "./lib/artifact_tool.mjs";

const { FileBlob, SpreadsheetFile, Workbook, nodeModulesPath } = await loadArtifactTool();
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const skillDir = path.resolve(scriptDir, "..");
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "patient-adverse-reaction-light-selection-"));
const sourcePath = path.join(tempDir, "审核后患者明细.xlsx");
const outputPath = path.join(tempDir, "patients.json");
const recordsPath = path.join(tempDir, "records.json");
const workbookPath = path.join(tempDir, "不良反应清单.xlsx");

const headers = [
  "序号", "userid", "患者姓名", "激活时间", "性别", "年龄", "疾病", "手机号码", "地区",
  "患者标签", "既往过敏史", "联合用药", "处方清单", "手术名称", "全病程方案名称", "AI状态", "确认状态",
];
const prescription = "奥美拉唑肠溶胶囊 规格20mg/粒，每次20mg，口服，每日1次，早餐前服用，连续14天";
const rows = [
  [1, "U-NORMAL", "甲*", "2026-08-01 10:00:00", "男", 40, "慢性胃炎", "", "", "正常", "无", "奥美拉唑肠溶胶囊", prescription, "", "慢性胃炎方案", "已生成", "已确认"],
  [2, "U-MILD", "乙*", "2026-08-02 10:00:00", "女", 41, "慢性胃炎", "", "", "轻度", "无", "奥美拉唑肠溶胶囊", prescription, "", "慢性胃炎方案", "已生成", "已确认"],
  [3, "U-MEDIUM", "丙*", "2026-08-03 10:00:00", "男", 42, "慢性胃炎", "", "", "中度", "无", "奥美拉唑肠溶胶囊", prescription, "", "慢性胃炎方案", "已生成", "已确认"],
  [4, "U-HIGH", "丁*", "2026-08-04 10:00:00", "女", 43, "慢性胃炎", "", "", "高度", "无", "奥美拉唑肠溶胶囊", prescription, "", "慢性胃炎方案", "已生成", "已确认"],
];

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Sheet1");
sheet.getRange("A1:Q5").values = [headers, ...rows];
await (await SpreadsheetFile.exportXlsx(workbook)).save(sourcePath);

const result = spawnSync(process.execPath, [
  path.join(scriptDir, "extract_adverse_reaction_patients.mjs"),
  "--input", sourcePath,
  "--count", "3",
  "--output", outputPath,
], { encoding: "utf8", env: { ...process.env, CODEX_NODE_MODULES: nodeModulesPath } });

assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
const selected = JSON.parse(await fs.readFile(outputPath, "utf8"));
assert.deepEqual(selected.map((patient) => patient.userid), ["U-MILD", "U-MEDIUM", "U-HIGH"]);
assert.deepEqual(selected.map((patient) => patient.adverseReactionLevel), ["轻度", "中度", "高度"]);

const records = selected.map((patient) => ({
  userid: patient.userid,
  symptomDescription: "出现短暂恶心和轻微头晕。",
  treatmentMeasures: patient.adverseReactionLevel === "高度"
    ? "立即停止活动并联系医疗机构评估。"
    : "暂停活动并记录症状变化，必要时联系医疗机构评估。",
  outcome: "症状较前减轻，继续观察。",
  remarks: "若症状持续或加重，应及时就医。",
}));
await fs.writeFile(recordsPath, JSON.stringify(records, null, 2), "utf8");

const buildResult = spawnSync(process.execPath, [
  path.join(scriptDir, "build_adverse_reaction_workbook.mjs"),
  "--input", sourcePath,
  "--records", recordsPath,
  "--count", "3",
  "--template", path.join(skillDir, "assets", "adverse-reaction-list-template.xlsx"),
  "--output", workbookPath,
], { encoding: "utf8", env: { ...process.env, CODEX_NODE_MODULES: nodeModulesPath } });

assert.equal(buildResult.status, 0, `${buildResult.stdout}\n${buildResult.stderr}`);
const outputWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(workbookPath));
const outputRows = outputWorkbook.worksheets.getItemAt(0).getUsedRange(true).values.slice(1);
assert.deepEqual(outputRows.map((row) => row[1]), ["U-MILD", "U-MEDIUM", "U-HIGH"]);
assert.deepEqual(outputRows.map((row) => row[5]), ["轻度", "中度", "高度"]);
assert.deepEqual(outputRows.map((row) => row[8]), ["否", "否", "是"]);

console.log(JSON.stringify({ status: "passed", selected: selected.length }));
