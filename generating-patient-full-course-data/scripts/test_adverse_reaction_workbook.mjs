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
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "patient-adverse-reaction-skill-"));
const sourcePath = path.join(tempDir, "审核后患者明细.xlsx");
const extractedPath = path.join(tempDir, "patients.json");
const recordsPath = path.join(tempDir, "records.json");
const outputPath = path.join(tempDir, "不良反应清单_生成.xlsx");

const headers = [
  "序号", "userid", "患者姓名", "激活时间", "性别", "年龄", "疾病", "手机号码", "地区",
  "患者标签", "既往过敏史", "联合用药", "处方清单", "手术名称", "全病程方案名称", "AI状态", "确认状态",
];
const rows = [
  [1, "U001", "甲*", "2026-08-01 10:00:00", "男", 70, "心房颤动", "", "", "中度", "青霉素过敏", "利伐沙班片", "利伐沙班片 规格10mg/片，每次10mg，口服，每日1次，晚餐中服用，长期", "", "心房颤动用药管理方案", "已生成", "已确认"],
  [2, "U002", "乙*", "2026-08-12 11:00:00", "女", 42, "慢性胃炎", "", "", "轻度", "青霉素过敏", "奥美拉唑肠溶胶囊", "奥美拉唑肠溶胶囊 规格20mg/粒，每次20mg，口服，每日1次，早餐前服用，连续14天", "", "慢性胃炎用药随访方案", "已生成", "已确认"],
  [3, "U003", "丙*", "2026-08-18 02:15:30", "女", 58, "二度Ⅱ型房室传导阻滞", "", "", "高度", "无", "对乙酰氨基酚片", "对乙酰氨基酚片 规格0.5g/片，每次0.5g，口服，每日2次，餐后服用，连续3天", "永久心脏起搏器植入术", "房室传导阻滞术后随访方案", "已生成", "已确认"],
  [4, "U004", "丁*", "2026-09-07 15:20:10", "男", 36, "支气管哮喘", "", "", "中度", "无", "布地奈德吸入剂", "布地奈德吸入剂 规格200μg/吸，每次1吸，吸入，每日2次，早晚使用，长期", "", "支气管哮喘长期管理方案", "已生成", "已确认"],
];

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Sheet1");
sheet.getRange("A1:Q5").values = [headers, ...rows];
await (await SpreadsheetFile.exportXlsx(workbook)).save(sourcePath);

const records = [
  {
    userid: "U001",
    symptomDescription: "出现心悸、胸闷较前加重，伴短暂头晕。",
    treatmentMeasures: "暂停活动并记录症状，复核当前抗凝用药和心率相关用药，联系心血管专科评估。",
    outcome: "经初步处理后症状较前减轻，仍需继续观察并按医嘱复诊。",
    remarks: "既往青霉素过敏；关注持续胸痛、晕厥、明显呼吸困难或异常出血，出现上述情况及时就医。",
  },
  {
    userid: "U003",
    symptomDescription: "出现明显乏力、头晕和近乎晕厥感，活动耐量下降。",
    treatmentMeasures: "立即停止活动并保持平卧，联系心血管专科进行心电节律评估及起搏器相关检查。",
    outcome: "经及时评估和处理后主观不适有所减轻，需继续严密观察心率及意识状态。",
    remarks: "如发生晕厥、持续胸闷、呼吸困难或意识改变，应立即急诊就医。",
  },
];
await fs.writeFile(recordsPath, JSON.stringify(records, null, 2), "utf8");

const run = (script, args) => spawnSync(process.execPath, [path.join(scriptDir, script), ...args], {
  encoding: "utf8",
  env: { ...process.env, CODEX_NODE_MODULES: nodeModules },
});

const extractResult = run("extract_adverse_reaction_patients.mjs", ["--input", sourcePath, "--count", "2", "--output", extractedPath]);
assert.equal(extractResult.status, 0, `${extractResult.stdout}\n${extractResult.stderr}`);
const extracted = JSON.parse(await fs.readFile(extractedPath, "utf8"));
assert.deepEqual(extracted.map(({ userid }) => userid), ["U001", "U003"]);
assert.deepEqual(extracted.map(({ adverseReactionLevel }) => adverseReactionLevel), ["中度", "高度"]);

const buildResult = run("build_adverse_reaction_workbook.mjs", [
  "--input", sourcePath,
  "--records", recordsPath,
  "--count", "2",
  "--template", path.join(skillDir, "assets", "adverse-reaction-list-template.xlsx"),
  "--output", outputPath,
]);
assert.equal(buildResult.status, 0, `${buildResult.stdout}\n${buildResult.stderr}`);

const outputWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
const outputSheet = outputWorkbook.worksheets.getItemAt(0);
const outputRows = outputSheet.getUsedRange(true).values;
assert.deepEqual(outputRows[0], ["序号", "患者ID", "疾病", "不良反应发生时间", "不良反应症状描述", "不良反应严重程度分级", "处理措施", "处理结果/转归", "是否触发人工干预", "备注"]);
assert.deepEqual(outputRows.slice(1).map((row) => row[1]), ["U001", "U003"]);
assert.deepEqual(outputRows.slice(1).map((row) => row[5]), ["中度", "高度"]);
assert.deepEqual(outputRows.slice(1).map((row) => row[8]), ["否", "是"]);
assert.equal(outputSheet.tables.items.length, 1);

for (let index = 0; index < extracted.length; index += 1) {
  const occurrence = new Date(outputRows[index + 1][3].replace(" ", "T"));
  const activation = new Date(extracted[index].activateTime.replace(" ", "T"));
  assert(occurrence > activation, `${extracted[index].userid}发生时间未严格晚于激活时间`);
  assert.equal(occurrence.getFullYear(), activation.getFullYear());
  assert.equal(occurrence.getMonth(), activation.getMonth());
  const secondsOfDay = occurrence.getHours() * 3600 + occurrence.getMinutes() * 60 + occurrence.getSeconds();
  assert(secondsOfDay >= 6 * 3600, `${extracted[index].userid}发生时间早于06:00:00`);
  assert(secondsOfDay <= 21 * 3600 + 59 * 60 + 59, `${extracted[index].userid}发生时间晚于21:59:59`);
}

const repeatedOutput = path.join(tempDir, "不良反应清单_重复生成.xlsx");
const repeatResult = run("build_adverse_reaction_workbook.mjs", [
  "--input", sourcePath, "--records", recordsPath, "--count", "2",
  "--template", path.join(skillDir, "assets", "adverse-reaction-list-template.xlsx"), "--output", repeatedOutput,
]);
assert.equal(repeatResult.status, 0, `${repeatResult.stdout}\n${repeatResult.stderr}`);
const repeatedWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(repeatedOutput));
assert.deepEqual(repeatedWorkbook.worksheets.getItemAt(0).getUsedRange(true).values, outputRows);

const missingCount = run("extract_adverse_reaction_patients.mjs", ["--input", sourcePath, "--output", extractedPath]);
assert.notEqual(missingCount.status, 0);
assert.match(`${missingCount.stdout}\n${missingCount.stderr}`, /缺少参数：--count/);
const invalidCount = run("extract_adverse_reaction_patients.mjs", ["--input", sourcePath, "--count", "0", "--output", extractedPath]);
assert.notEqual(invalidCount.status, 0);
assert.match(`${invalidCount.stdout}\n${invalidCount.stderr}`, /数量必须为正整数/);
const insufficient = run("extract_adverse_reaction_patients.mjs", ["--input", sourcePath, "--count", "4", "--output", extractedPath]);
assert.notEqual(insufficient.status, 0);
assert.match(`${insufficient.stdout}\n${insufficient.stderr}`, /符合条件的中度或高度患者仅3位/);

await fs.writeFile(recordsPath, JSON.stringify([{ ...records[0], extra: "禁止字段" }, records[1]], null, 2), "utf8");
const malformed = run("build_adverse_reaction_workbook.mjs", [
  "--input", sourcePath, "--records", recordsPath, "--count", "2",
  "--template", path.join(skillDir, "assets", "adverse-reaction-list-template.xlsx"), "--output", outputPath,
]);
assert.notEqual(malformed.status, 0);
assert.match(`${malformed.stdout}\n${malformed.stderr}`, /必须且只能依次包含5个字段/);

console.log(JSON.stringify({ status: "passed", patients: extracted.length, rows: outputRows.length }));
