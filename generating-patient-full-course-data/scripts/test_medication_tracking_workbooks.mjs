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
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "patient-medication-tracking-skill-"));
const sourcePath = path.join(tempDir, "审核后患者明细.xlsx");
const extractedPath = path.join(tempDir, "patients.json");
const recordsPath = path.join(tempDir, "records.json");
const trackingOutput = path.join(tempDir, "跟踪提醒_生成.xlsx");
const medicationOutput = path.join(tempDir, "用药清单_生成.xlsx");

function parseDateTime(value) {
  return new Date(String(value).replace(" ", "T"));
}

function assertValidConfirmationTime(value, activationText, userid) {
  const activation = parseDateTime(activationText);
  const confirmation = parseDateTime(value);
  assert(confirmation > activation, `${userid}用药方案确认时间必须严格晚于激活时间`);
  assert.equal(confirmation.getFullYear(), activation.getFullYear(), `${userid}确认时间年份改变`);
  assert.equal(confirmation.getMonth(), activation.getMonth(), `${userid}确认时间月份改变`);
  const secondsOfDay = confirmation.getHours() * 3600 + confirmation.getMinutes() * 60 + confirmation.getSeconds();
  assert(secondsOfDay >= 6 * 3600, `${userid}确认时间早于06:00:00`);
  assert(secondsOfDay <= 21 * 3600 + 59 * 60 + 59, `${userid}确认时间晚于21:59:59`);
}

const sourceHeaders = [
  "序号", "userid", "患者姓名", "激活时间", "性别", "年龄", "疾病", "手机号码", "地区",
  "患者标签", "既往过敏史", "联合用药", "处方清单", "手术名称", "全病程方案名称", "AI状态", "确认状态",
];
const sourceRows = [
  [1, "U001", "甲*", "2026-08-01 10:00:00", "男", 70, "心房颤动", "", "", "高度", "无", "利伐沙班片+对乙酰氨基酚片", "利伐沙班片 规格10mg/片，每次10mg，口服，每日1次，晚餐中服用，长期 + 对乙酰氨基酚片 规格0.5g/片，每次0.5g，口服，每8小时1次，餐后服用，连续3天", "", "心房颤动用药管理方案", "已生成", "已确认"],
  [2, "U002", "乙*", "2026-08-12 11:00:00", "女", 42, "慢性胃炎", "", "", "轻度", "青霉素过敏", "奥美拉唑肠溶胶囊+铝碳酸镁咀嚼片", "奥美拉唑肠溶胶囊 规格20mg/粒，每次20mg，口服，每日1次，早餐前服用，连续14天 + 铝碳酸镁咀嚼片 规格0.5g/片，每次1g，口服，每日3次，餐后1小时服用，连续14天", "", "慢性胃炎用药随访方案", "已生成", "已确认"],
];
const records = [
  {
    userid: "U001",
    medicationPlan: "针对70岁男性心房颤动患者，按审核处方使用利伐沙班片进行抗凝管理，并短期使用对乙酰氨基酚片进行疼痛或发热对症管理；固定时间核对用药，关注出血及肝脏相关风险，调整前由医生或药师复核。",
    medicationCycle: "利伐沙班片按审核方案长期维持；对乙酰氨基酚片连续3天，完成后不自行延长。",
    medicationItems: [
      { drugName: "利伐沙班片", specification: "10mg/片", singleDose: "10mg", frequency: "每日1次", medicationTime: "晚餐中", treatmentDays: "长期", precautions: "随餐服用并观察牙龈出血、血尿、黑便或异常瘀斑；联合用药或新增药物前由医生或药师核对相互作用。" },
      { drugName: "对乙酰氨基酚片", specification: "0.5g/片", singleDose: "0.5g", frequency: "每8小时1次", medicationTime: "餐后", treatmentDays: 3, precautions: "每日总量不得超过审核处方限量，避免与含同成分复方制剂同服；联合用药期间新增药物前咨询医生。" },
    ],
  },
  {
    userid: "U002",
    medicationPlan: "针对42岁女性慢性胃炎患者，按审核处方使用奥美拉唑肠溶胶囊和铝碳酸镁咀嚼片，规范餐前与餐后时机并保持药物间隔；结合青霉素过敏史核对新增药物，由医生或药师复核疗程。",
    medicationCycle: "奥美拉唑肠溶胶囊与铝碳酸镁咀嚼片均连续14天，疗程结束后根据症状和复诊意见决定是否调整。",
    medicationItems: [
      { drugName: "奥美拉唑肠溶胶囊", specification: "20mg/粒", singleDose: "20mg", frequency: "每日1次", medicationTime: "早餐前", treatmentDays: 14, precautions: "整粒吞服，不自行延长疗程；既往青霉素过敏，联合用药期间新增药物前由医生或药师核对。" },
      { drugName: "铝碳酸镁咀嚼片", specification: "0.5g/片", singleDose: "1g", frequency: "每日3次", medicationTime: "餐后1小时", treatmentDays: 14, precautions: "充分咀嚼，与其他口服药间隔至少2小时；既往青霉素过敏，联合用药期间注意核对相互作用。" },
    ],
  },
];

const sourceWorkbook = Workbook.create();
const sourceSheet = sourceWorkbook.worksheets.add("Sheet1");
sourceSheet.getRange("A1:Q3").values = [sourceHeaders, ...sourceRows];
await (await SpreadsheetFile.exportXlsx(sourceWorkbook)).save(sourcePath);
await fs.writeFile(recordsPath, JSON.stringify(records, null, 2), "utf8");

const run = (script, args) => spawnSync(process.execPath, [path.join(scriptDir, script), ...args], {
  encoding: "utf8",
  env: { ...process.env, CODEX_NODE_MODULES: nodeModules },
});
const serviceArgs = ["--service-start", "2026-08-01", "--service-end", "2026-08-10"];
const extractResult = run("extract_medication_tracking_patients.mjs", ["--input", sourcePath, ...serviceArgs, "--output", extractedPath]);
assert.equal(extractResult.status, 0, `${extractResult.stdout}\n${extractResult.stderr}`);
const extracted = JSON.parse(await fs.readFile(extractedPath, "utf8"));
assert.deepEqual(extracted.map(({ userid }) => userid), ["U001", "U002"]);
assert.deepEqual(extracted[0].combinedMedication, ["利伐沙班片", "对乙酰氨基酚片"]);
assert.equal(extracted[0].serviceStartDate, "2026-08-01");
assert.equal(extracted[0].serviceEndDate, "2026-08-10");
assert.equal(extracted[0].adverseReactionLevel, "高度");

const buildArgs = [
  "--input", sourcePath, "--records", recordsPath,
  ...serviceArgs,
  "--tracking-template", path.join(skillDir, "assets", "medication-tracking-template.xlsx"),
  "--medication-template", path.join(skillDir, "assets", "medication-list-template.xlsx"),
  "--tracking-output", trackingOutput, "--medication-output", medicationOutput,
];
const buildResult = run("build_medication_tracking_workbooks.mjs", buildArgs);
assert.equal(buildResult.status, 0, `${buildResult.stdout}\n${buildResult.stderr}`);

const trackingWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(trackingOutput));
const trackingSheet = trackingWorkbook.worksheets.getItemAt(0);
const trackingRows = trackingSheet.getUsedRange(true).values;
assert.deepEqual(trackingRows[0], ["序号", "患者ID", "姓名", "性别", "年龄", "疾病", "既往过敏史", "联合用药", "体温监测次数", "血压、心率监测次数", "用药提醒次数", "用药方案", "用药周期", "方案链接", "患者响应率", "是否触发人工干预"]);
assert.deepEqual(trackingRows.slice(1).map((row) => row[1]), ["U001", "U002"]);
for (const row of trackingRows.slice(1)) {
  const days = row[1] === "U001" ? 10 : 1;
  assert(row[8] >= Math.round(2 * days * 0.4) && row[8] <= Math.round(2 * days * 0.9));
  assert(row[9] >= Math.round(days * 0.5) && row[9] <= Math.round(days * 0.85));
  assert(row[10] >= Math.round(3 * days * 0.6) && row[10] <= Math.round(3 * days * 0.85));
  assert(Number.isInteger(row[14]) && row[14] >= 45 && row[14] <= 70);
}
assert.equal(trackingRows[1][15], "是");
assert.equal(trackingRows[2][15], "否");
const firstBuildMetrics = trackingRows.slice(1).map((row) => row.slice(8, 11).concat(row.slice(14, 16)));
assert.equal(trackingSheet.tables.items.length, 1);

const repeatTrackingOutput = path.join(tempDir, "跟踪提醒_重复生成.xlsx");
const repeatMedicationOutput = path.join(tempDir, "用药清单_重复生成.xlsx");
const repeatBuildArgs = buildArgs.map((value, index) => {
  if (buildArgs[index - 1] === "--tracking-output") return repeatTrackingOutput;
  if (buildArgs[index - 1] === "--medication-output") return repeatMedicationOutput;
  return value;
});
const repeatResult = run("build_medication_tracking_workbooks.mjs", repeatBuildArgs);
assert.equal(repeatResult.status, 0, `${repeatResult.stdout}\n${repeatResult.stderr}`);
const repeatWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(repeatTrackingOutput));
const repeatRows = repeatWorkbook.worksheets.getItemAt(0).getUsedRange(true).values;
assert.deepEqual(repeatRows.slice(1).map((row) => row.slice(8, 11).concat(row.slice(14, 16))), firstBuildMetrics);

const missingPeriodResult = run("extract_medication_tracking_patients.mjs", ["--input", sourcePath, "--output", extractedPath]);
assert.notEqual(missingPeriodResult.status, 0);
assert.match(`${missingPeriodResult.stdout}\n${missingPeriodResult.stderr}`, /缺少服务周期参数/);
const invalidPeriodResult = run("extract_medication_tracking_patients.mjs", ["--input", sourcePath, "--service-start", "2026-08-11", "--service-end", "2026-08-10", "--output", extractedPath]);
assert.notEqual(invalidPeriodResult.status, 0);
assert.match(`${invalidPeriodResult.stdout}\n${invalidPeriodResult.stderr}`, /开始日期不得晚于结束日期/);

const medicationWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(medicationOutput));
const medicationSheet = medicationWorkbook.worksheets.getItemAt(0);
const medicationRows = medicationSheet.getUsedRange(true).values;
assert.deepEqual(medicationRows[0], ["userid", "用药方案确认时间", "药品名称", "规格", "单次剂量", "用药频率", "用药时间", "疗程天数", "注意事项"]);
assert.deepEqual(medicationRows.slice(1).map((row) => row[0]), ["U001", "U001", "U002", "U002"]);
assert.deepEqual(medicationRows.slice(1).map((row) => row[2]), ["利伐沙班片", "对乙酰氨基酚片", "奥美拉唑肠溶胶囊", "铝碳酸镁咀嚼片"]);
const activationByUserid = new Map(sourceRows.map((row) => [row[1], row[3]]));
for (const row of medicationRows.slice(1)) assertValidConfirmationTime(row[1], activationByUserid.get(row[0]), row[0]);
const confirmationsByUserid = new Map();
for (const row of medicationRows.slice(1)) {
  const existing = confirmationsByUserid.get(row[0]);
  if (existing) assert.equal(row[1], existing, `${row[0]}的所有用药行必须共用一个确认时间`);
  else confirmationsByUserid.set(row[0], row[1]);
}
const repeatMedicationWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(repeatMedicationOutput));
const repeatMedicationRows = repeatMedicationWorkbook.worksheets.getItemAt(0).getUsedRange(true).values;
assert.deepEqual(repeatMedicationRows.slice(1).map((row) => [row[0], row[1]]), medicationRows.slice(1).map((row) => [row[0], row[1]]));
assert.equal(medicationSheet.tables.items.length, 1);

async function assertInvalid(invalidRecords, expectedMessage) {
  await fs.writeFile(recordsPath, JSON.stringify(invalidRecords, null, 2), "utf8");
  const result = run("build_medication_tracking_workbooks.mjs", buildArgs);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, expectedMessage);
}

await assertInvalid([{ ...records[0], medicationCycle: "自2026-08-01起长期治疗", medicationItems: records[0].medicationItems }, records[1]], /不得依据激活日期/);
await assertInvalid([{ ...records[0], medicationItems: [{ ...records[0].medicationItems[0], drugName: "阿司匹林肠溶片" }, records[0].medicationItems[1]] }, records[1]], /同序一一对应/);
await assertInvalid([{ ...records[0], medicationItems: [{ ...records[0].medicationItems[0], frequency: "qd" }, records[0].medicationItems[1]] }, records[1]], /中文量化格式/);
await assertInvalid([{ ...records[0], medicationItems: [{ ...records[0].medicationItems[0], medicationTime: "口服" }, records[0].medicationItems[1]] }, records[1]], /规范服药时机/);
await assertInvalid([records[0], { ...records[1], medicationItems: [{ ...records[1].medicationItems[0], precautions: "整粒吞服。" }, records[1].medicationItems[1]] }], /必须提示既往过敏史/);
await assertInvalid([{ ...records[0], medicationItems: [{ ...records[0].medicationItems[0], frequency: "每日1次随便" }, records[0].medicationItems[1]] }, records[1]], /中文量化格式/);
await assertInvalid([{ ...records[0], medicationItems: [{ ...records[0].medicationItems[0], medicationTime: "吸入" }, records[0].medicationItems[1]] }, records[1]], /规范服药时机/);
await assertInvalid([{ ...records[0], medicationItems: [{ ...records[0].medicationItems[0], treatmentDays: 7 }, records[0].medicationItems[1]] }, records[1]], /疗程必须与审核处方一致/);
await assertInvalid([{ ...records[0], medicationCycle: "激活后第7天开始长期治疗", medicationItems: records[0].medicationItems }, records[1]], /不得以激活时间为周期锚点/);
await assertInvalid([{ ...records[0], medicationPlan: records[0].medicationPlan.replace("利伐沙班片", "抗凝药"), medicationItems: records[0].medicationItems }, records[1]], /medicationPlan遗漏联合用药/);
await assertInvalid([{ ...records[0], medicationCycle: "以激活日为起点长期治疗", medicationItems: records[0].medicationItems }, records[1]], /不得以激活时间为周期锚点/);
await assertInvalid([{ ...records[0], medicationItems: [{ ...records[0].medicationItems[0], singleDose: "0mg" }, records[0].medicationItems[1]] }, records[1]], /单次剂量必须与审核处方一致/);
await assertInvalid([{ ...records[0], medicationItems: [{ ...records[0].medicationItems[0], precautions: "观察出血。" }, records[0].medicationItems[1]] }, records[1]], /联合用药核对或相互作用风险/);

sourceRows[0][3] = "2026-08-31 21:59:59";
const noWindowSourceWorkbook = Workbook.create();
const noWindowSourceSheet = noWindowSourceWorkbook.worksheets.add("Sheet1");
noWindowSourceSheet.getRange("A1:Q3").values = [sourceHeaders, ...sourceRows];
await (await SpreadsheetFile.exportXlsx(noWindowSourceWorkbook)).save(sourcePath);
await fs.writeFile(recordsPath, JSON.stringify(records, null, 2), "utf8");
const noConfirmationWindowResult = run("build_medication_tracking_workbooks.mjs", buildArgs);
assert.notEqual(noConfirmationWindowResult.status, 0);
assert.match(`${noConfirmationWindowResult.stdout}\n${noConfirmationWindowResult.stderr}`, /U001当月不存在严格晚于激活时间且位于06:00:00至21:59:59的合法确认时间/);

console.log(JSON.stringify({ status: "passed", patients: 2, trackingRows: trackingRows.length, medicationRows: medicationRows.length }));
