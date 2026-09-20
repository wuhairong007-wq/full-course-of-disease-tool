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
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "patient-medication-tracking-skill-"));
const sourcePath = path.join(tempDir, "审核后患者明细.xlsx");
const extractedPath = path.join(tempDir, "patients.json");
const recordsPath = path.join(tempDir, "records.json");
const trackingOutput = path.join(tempDir, "跟踪提醒_生成.xlsx");
const medicationOutput = path.join(tempDir, "用药清单_生成.xlsx");

function parseDateTime(value) {
  return new Date(String(value).replace(" ", "T"));
}

const secondsOfDay = (date) => date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
const formatLocalDate = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");

function assertValidConfirmationTime(value, activationText, serviceStartText, serviceEndText, userid) {
  const activation = parseDateTime(activationText);
  const serviceStart = parseDateTime(`${serviceStartText} 00:00:00`);
  const serviceEnd = parseDateTime(`${serviceEndText} 00:00:00`);
  const confirmation = parseDateTime(value);
  assert(confirmation > activation, `${userid}用药方案确认时间必须严格晚于激活时间`);
  assert(confirmation - activation <= 7 * 24 * 3600 * 1000, `${userid}用药方案确认时间必须在激活时间后7天内`);
  assert(confirmation >= serviceStart, `${userid}用药方案确认时间不得早于服务周期开始日期`);
  assert(confirmation < serviceEnd, `${userid}用药方案确认时间不得落在服务周期最后一天`);
  if (activation.getHours() < 12) {
    assert.equal(formatLocalDate(confirmation), formatLocalDate(activation), `${userid}上午激活后必须当日下午确认`);
    assert(secondsOfDay(confirmation) >= 12 * 3600, `${userid}上午激活后的确认时间早于12:00:00`);
    assert(secondsOfDay(confirmation) <= 21 * 3600 + 59 * 60 + 59, `${userid}确认时间晚于21:59:59`);
  } else {
    const expected = new Date(activation);
    expected.setDate(expected.getDate() + 1);
    assert.equal(formatLocalDate(confirmation), formatLocalDate(expected), `${userid}下午激活后必须次日上午确认`);
    assert(secondsOfDay(confirmation) >= 7 * 3600 + 30 * 60, `${userid}下午激活后的确认时间早于07:30:00`);
    assert(secondsOfDay(confirmation) <= 11 * 3600 + 59 * 60 + 59, `${userid}下午激活后的确认时间晚于11:59:59`);
  }
}

const sourceHeaders = [
  "序号", "userid", "患者姓名", "激活时间", "性别", "年龄", "疾病", "手机号码", "地区",
  "患者标签", "既往过敏史", "联合用药", "处方清单", "手术名称", "全病程方案名称", "AI状态", "确认状态",
];
const sourceRows = [
  [1, "U001", "甲*", "2026-08-01 10:00:00", "男", 70, "心房颤动", "", "", "重度", "无", "利伐沙班片+盐酸昂丹司琼注射液", "利伐沙班片 规格10mg/片，每次10mg，口服，每日1次，晚餐中服用，长期 + 盐酸昂丹司琼注射液 规格2mL:4mg，每次4mg，静脉注射，麻醉诱导前给药，单次给药", "", "心房颤动用药管理方案", "已生成", "已确认"],
  [2, "U002", "乙*", "2026-08-12 15:00:00", "女", 42, "慢性胃炎", "", "", "无", "青霉素过敏", "奥美拉唑肠溶胶囊+铝碳酸镁咀嚼片", "奥美拉唑肠溶胶囊 规格20mg/粒，每次20mg，口服，每日1次，早餐前服用，连续14天 + 铝碳酸镁咀嚼片 规格0.5g/片，每次1g，口服，每日3次，餐后1小时服用，连续14天", "", "慢性胃炎用药随访方案", "已生成", "已确认"],
];
const records = [
  {
    userid: "U001",
    medicationPlan: "针对70岁男性心房颤动患者，使用利伐沙班片进行抗凝管理，并单次使用盐酸昂丹司琼注射液进行恶心呕吐防治；固定时间核对用药，关注出血、心律及联合用药相互作用。",
    medicationCycle: "利伐沙班片长期维持，盐酸昂丹司琼注射液单次给药，完成后不重复使用。",
    medicationItems: [
      { drugName: "利伐沙班片", specification: "10mg/片", singleDose: "10mg", frequency: "每日1次", medicationTime: "晚餐中", treatmentDays: "长期", precautions: "随餐服用并观察牙龈出血、血尿、黑便或异常瘀斑；联合用药或新增药物前核对相互作用。" },
      { drugName: "盐酸昂丹司琼注射液", specification: "2mL:4mg", singleDose: "4mg", frequency: "单次", medicationTime: "固定时间", treatmentDays: 1, precautions: "关注心悸、头晕和QT间期延长风险；联合用药期间新增药物前核对相互作用。" },
    ],
  },
  {
    userid: "U002",
    medicationPlan: "针对42岁女性慢性胃炎患者，使用奥美拉唑肠溶胶囊和铝碳酸镁咀嚼片，规范餐前与餐后时机并保持药物间隔；结合青霉素过敏史核对新增药物，核对疗程。",
    medicationCycle: "奥美拉唑肠溶胶囊与铝碳酸镁咀嚼片均连续14天，疗程结束后根据症状和复诊意见决定是否调整。",
    medicationItems: [
      { drugName: "奥美拉唑肠溶胶囊", specification: "20mg/粒", singleDose: "20mg", frequency: "每日1次", medicationTime: "早餐前", treatmentDays: 14, precautions: "整粒吞服，不自行延长疗程；既往青霉素过敏，联合用药期间新增药物前核对过敏风险。" },
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
  env: { ...process.env, CODEX_NODE_MODULES: nodeModulesPath },
});
const serviceArgs = ["--service-start", "2026-08-01", "--service-end", "2026-08-31"];
const extractResult = run("extract_medication_tracking_patients.mjs", ["--input", sourcePath, ...serviceArgs, "--output", extractedPath]);
assert.equal(extractResult.status, 0, `${extractResult.stdout}\n${extractResult.stderr}`);
const extracted = JSON.parse(await fs.readFile(extractedPath, "utf8"));
assert.deepEqual(extracted.map(({ userid }) => userid), ["U001", "U002"]);
assert.deepEqual(extracted[0].combinedMedication, ["利伐沙班片", "盐酸昂丹司琼注射液"]);
assert.equal(extracted[0].serviceStartDate, "2026-08-01");
assert.equal(extracted[0].serviceEndDate, "2026-08-31");
assert.equal(extracted[0].adverseReactionLevel, "高度");
assert.equal(extracted[1].adverseReactionLevel, "正常");

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
assert.deepEqual(trackingRows.slice(1).map((row) => row[12]), records.map((record) => record.medicationCycle));
for (const row of trackingRows.slice(1)) assert.doesNotMatch(row[12], /^\s*(?:自|从)\s*\d{4}/);
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
// A source already migrated to 正常 must retain identical downstream behavior.
sourceRows[1][9] = "正常";
sourceSheet.getRange("A1:Q3").values = [sourceHeaders, ...sourceRows];
await (await SpreadsheetFile.exportXlsx(sourceWorkbook)).save(sourcePath);
const normalExtract = run("extract_medication_tracking_patients.mjs", ["--input", sourcePath, ...serviceArgs, "--output", extractedPath]);
assert.equal(normalExtract.status, 0, `${normalExtract.stdout}\n${normalExtract.stderr}`);
assert.deepEqual(JSON.parse(await fs.readFile(extractedPath, "utf8")), extracted);
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
assert.deepEqual(medicationRows.slice(1).map((row) => row[2]), ["利伐沙班片", "盐酸昂丹司琼注射液", "奥美拉唑肠溶胶囊", "铝碳酸镁咀嚼片"]);
assert.equal(medicationRows[2][5], "单次");
assert.equal(medicationRows[2][7], 1);
const confirmationByUseridForMetrics = new Map(medicationRows.slice(1).map((row) => [row[0], row[1]]));
for (const row of trackingRows.slice(1)) {
  const confirmationDate = parseDateTime(confirmationByUseridForMetrics.get(row[1]));
  const serviceEnd = parseDateTime("2026-08-31 00:00:00");
  const confirmationCalendarDate = new Date(confirmationDate.getFullYear(), confirmationDate.getMonth(), confirmationDate.getDate());
  const days = Math.max(Math.floor((serviceEnd - confirmationCalendarDate) / 86400000) + 1, 1);
  assert(row[8] >= Math.round(2 * days * 0.4) && row[8] <= Math.round(2 * days * 0.9));
  assert(row[9] >= Math.round(days * 0.5) && row[9] <= Math.round(days * 0.85));
  assert(row[10] >= Math.round(3 * days * 0.6) && row[10] <= Math.round(3 * days * 0.85));
  assert(Number.isInteger(row[14]) && row[14] >= 45 && row[14] <= 70);
}
const activationByUserid = new Map(sourceRows.map((row) => [row[1], row[3]]));
for (const row of medicationRows.slice(1)) assertValidConfirmationTime(row[1], activationByUserid.get(row[0]), "2026-08-01", "2026-08-31", row[0]);
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

await assertInvalid([{ ...records[0], medicationCycle: "自2026年-08-28起，长期治疗", medicationItems: records[0].medicationItems }, records[1]], /开头不得使用日期文案/);
await assertInvalid([{ ...records[0], medicationItems: [{ ...records[0].medicationItems[0], drugName: "阿司匹林肠溶片" }, records[0].medicationItems[1]] }, records[1]], /同序一一对应/);
await assertInvalid([{ ...records[0], medicationItems: [{ ...records[0].medicationItems[0], frequency: "qd" }, records[0].medicationItems[1]] }, records[1]], /中文量化格式/);
await assertInvalid([{ ...records[0], medicationItems: [{ ...records[0].medicationItems[0], medicationTime: "口服" }, records[0].medicationItems[1]] }, records[1]], /规范服药时机/);
await assertInvalid([records[0], { ...records[1], medicationItems: [{ ...records[1].medicationItems[0], precautions: "整粒吞服。" }, records[1].medicationItems[1]] }], /必须提示既往过敏史/);
await assertInvalid([{ ...records[0], medicationItems: [{ ...records[0].medicationItems[0], frequency: "每日1次随便" }, records[0].medicationItems[1]] }, records[1]], /中文量化格式/);
await assertInvalid([{ ...records[0], medicationItems: [{ ...records[0].medicationItems[0], medicationTime: "吸入" }, records[0].medicationItems[1]] }, records[1]], /规范服药时机/);
await assertInvalid([{ ...records[0], medicationItems: [{ ...records[0].medicationItems[0], treatmentDays: 7 }, records[0].medicationItems[1]] }, records[1]], /疗程必须与审核处方一致/);
await assertInvalid([{ ...records[0], medicationCycle: "激活后第7天开始长期治疗", medicationItems: records[0].medicationItems }, records[1]], /不得使用激活后的相对偏移/);
await assertInvalid([{ ...records[0], medicationPlan: records[0].medicationPlan.replace("利伐沙班片", "抗凝药"), medicationItems: records[0].medicationItems }, records[1]], /medicationPlan遗漏联合用药/);
await assertInvalid([{ ...records[0], medicationCycle: "以激活日为起点长期治疗", medicationItems: records[0].medicationItems }, records[1]], /不得使用激活后的相对偏移/);
await assertInvalid([{ ...records[0], medicationCycle: "第一阶段抗感染3天，第二阶段镇痛5天", medicationItems: records[0].medicationItems }, records[1]], /不得使用阶段化表述/);
await assertInvalid([{ ...records[0], medicationPlan: `${records[0].medicationPlan}按已审核处方执行。`, medicationItems: records[0].medicationItems }, records[1]], /不得引用已审核、已审定或已确认的处方或方案/);
await assertInvalid([{ ...records[0], medicationItems: [{ ...records[0].medicationItems[0], singleDose: "0mg" }, records[0].medicationItems[1]] }, records[1]], /单次剂量必须与审核处方一致/);
await assertInvalid([{ ...records[0], medicationItems: [{ ...records[0].medicationItems[0], precautions: "观察出血。" }, records[0].medicationItems[1]] }, records[1]], /联合用药核对或相互作用风险/);
await assertInvalid([{ ...records[0], medicationCycle: "源文件未提供明确周期，需医生确认", medicationItems: records[0].medicationItems }, records[1]], /占位文案/);

sourceRows[0][3] = "2026-07-20 10:00:00";
const expiredSourceWorkbook = Workbook.create();
const expiredSourceSheet = expiredSourceWorkbook.worksheets.add("Sheet1");
expiredSourceSheet.getRange("A1:Q3").values = [sourceHeaders, ...sourceRows];
await (await SpreadsheetFile.exportXlsx(expiredSourceWorkbook)).save(sourcePath);
await fs.writeFile(recordsPath, JSON.stringify(records, null, 2), "utf8");
const expiredTrackingOutput = path.join(tempDir, "跟踪提醒_超期.xlsx");
const expiredMedicationOutput = path.join(tempDir, "用药清单_超期.xlsx");
const expiredBuildArgs = buildArgs.map((value, index) => {
  if (buildArgs[index - 1] === "--tracking-output") return expiredTrackingOutput;
  if (buildArgs[index - 1] === "--medication-output") return expiredMedicationOutput;
  return value;
});
const expiredResult = run("build_medication_tracking_workbooks.mjs", expiredBuildArgs);
assert.notEqual(expiredResult.status, 0);
assert.match(`${expiredResult.stdout}\n${expiredResult.stderr}`, /U001.*目标确认时段.*不在服务周期/);
await assert.rejects(fs.access(expiredTrackingOutput), { code: "ENOENT" });
await assert.rejects(fs.access(expiredMedicationOutput), { code: "ENOENT" });

sourceRows[0][3] = "2026-08-30 15:00:00";
const noWindowSourceWorkbook = Workbook.create();
const noWindowSourceSheet = noWindowSourceWorkbook.worksheets.add("Sheet1");
noWindowSourceSheet.getRange("A1:Q3").values = [sourceHeaders, ...sourceRows];
await (await SpreadsheetFile.exportXlsx(noWindowSourceWorkbook)).save(sourcePath);
await fs.writeFile(recordsPath, JSON.stringify(records, null, 2), "utf8");
const noWindowExtractResult = run("extract_medication_tracking_patients.mjs", ["--input", sourcePath, ...serviceArgs, "--output", extractedPath]);
assert.equal(noWindowExtractResult.status, 0, `${noWindowExtractResult.stdout}\n${noWindowExtractResult.stderr}`);
const noWindowTrackingOutput = path.join(tempDir, "跟踪提醒_无目标时段.xlsx");
const noWindowMedicationOutput = path.join(tempDir, "用药清单_无目标时段.xlsx");
const noWindowBuildArgs = buildArgs.map((value, index) => {
  if (buildArgs[index - 1] === "--tracking-output") return noWindowTrackingOutput;
  if (buildArgs[index - 1] === "--medication-output") return noWindowMedicationOutput;
  return value;
});
const noConfirmationWindowResult = run("build_medication_tracking_workbooks.mjs", noWindowBuildArgs);
assert.notEqual(noConfirmationWindowResult.status, 0);
assert.match(`${noConfirmationWindowResult.stdout}\n${noConfirmationWindowResult.stderr}`, /U001.*目标确认时段.*2026-08-31 07:30:00.*服务周期/);
await assert.rejects(fs.access(noWindowTrackingOutput), { code: "ENOENT" });
await assert.rejects(fs.access(noWindowMedicationOutput), { code: "ENOENT" });

console.log(JSON.stringify({ status: "passed", patients: 2, trackingRows: trackingRows.length, medicationRows: medicationRows.length }));
