import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { loadArtifactTool } from "./lib/artifact_tool.mjs";

const run = promisify(execFile);
const { Workbook, FileBlob, SpreadsheetFile } = await loadArtifactTool();
const root = fileURLToPath(new URL("../", import.meta.url));
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "company-device-consumable-"));
const source = path.join(temp, "source.xlsx");
const recordsPath = path.join(temp, "records.json");
const reviewPath = path.join(temp, "review.json");
const output = path.join(temp, "patients.xlsx");
const template = path.join(root, "assets/patient-full-course-template.xlsx");

const sourceHeaders = [
  "序号", "userid", "患者姓名", "激活时间", "性别", "年龄", "疾病", "手机号码", "地区",
  "患者标签", "既往过敏史", "产品名称", "产品类型",
];
const sourceRows = [
  [1, "U-LISAI", "利赛患者", "2026-09-01 08:00:00", "男", 60, "原发性高血压", "", "", "无", "无", "利赛一次性介入器械", "器械"],
  [2, "U-XINFUJIA", "昕敷佳患者", "2026-09-02 08:00:00", "女", 55, "原发性高血压", "", "", "无", "无", "昕敷佳一次性介入器械", "器械"],
];
const medication = "缬沙坦胶囊";
const medicationPrescription = "缬沙坦胶囊 规格80mg/粒，每次80mg，口服，每日1次，早餐后服用，连续28天";
const records = [
  {
    userid: "U-LISAI", allergyHistory: "无", combinedMedication: [medication],
    prescriptionList: medicationPrescription,
    surgeryName: "原发性高血压介入治疗术（使用利赛一次性介入器械）",
    consumableName: "利赛一次性介入器械",
    coursePlanName: "原发性高血压介入治疗管理方案",
  },
  {
    userid: "U-XINFUJIA", allergyHistory: "无", combinedMedication: [medication],
    prescriptionList: `${medicationPrescription} + 耗材名称：昕敷佳一次性介入器械`,
    surgeryName: "原发性高血压介入治疗术（使用昕敷佳一次性介入器械）",
    consumableName: "昕敷佳一次性介入器械",
    coursePlanName: "原发性高血压介入治疗管理方案",
  },
];
const recordsForHunan = records.map((record) => ({
  ...record,
  prescriptionList: `${medicationPrescription} + 耗材名称：${record.consumableName}`,
}));

function reviewFor(record) {
  return {
    userid: record.userid,
    roles: ["产品", "病因/一线治疗", "维持治疗", "围手术期治疗", "症状支持"].map((role) => ({
      role,
      evidence: [{ field: "疾病", value: "原发性高血压" }],
      rationale: "导出行为测试夹具，不作为临床判断依据。",
      candidates: role === "产品" ? [{
        medication,
        indication: "测试用药映射",
        safetyAssessment: "仅用于验证导出结构。",
        eligible: true,
        selected: true,
        exclusionReason: "",
      }] : [],
      exclusionReason: role === "产品" ? "" : "测试夹具不选择该治疗角色",
    })),
  };
}

try {
  const workbook = Workbook.create();
  workbook.worksheets.add("患者").getRange("A1:M3").values = [sourceHeaders, ...sourceRows];
  await (await SpreadsheetFile.exportXlsx(workbook)).save(source);
  await fs.writeFile(recordsPath, JSON.stringify(records, null, 2));
  await fs.writeFile(reviewPath, JSON.stringify(records.map(reviewFor), null, 2));

  await run(process.execPath, [
    path.join(root, "scripts/build_workbook.mjs"),
    "--input", source,
    "--records", recordsPath,
    "--review", reviewPath,
    "--template", template,
    "--output", output,
    "--company", "山东利赛医药有限公司",
  ]);

  const saved = await SpreadsheetFile.importXlsx(await FileBlob.load(output));
  const values = saved.worksheets.getItemAt(0).getUsedRange(true).values;
  assert.deepEqual(values[0], [
    ...sourceHeaders.slice(0, 11), "联合用药", "处方清单", "手术名称", "耗材名称", "全病程方案名称", "AI状态", "确认状态",
  ]);
  assert.equal(values[1][14], "利赛一次性介入器械");
  assert.doesNotMatch(values[1][12], /利赛一次性介入器械/);

  const hunanArgs = [
    path.join(root, "scripts/build_workbook.mjs"),
    "--input", source,
    "--records", recordsPath,
    "--review", reviewPath,
    "--template", template,
    "--output", output,
    "--company", "湖南昕敷佳生物科技有限公司",
  ];
  await fs.writeFile(recordsPath, JSON.stringify(recordsForHunan, null, 2));
  await run(process.execPath, hunanArgs);
  const Hunan = await SpreadsheetFile.importXlsx(await FileBlob.load(output));
  const HunanValues = Hunan.worksheets.getItemAt(0).getUsedRange(true).values;
  assert.equal(HunanValues[2][14], "昕敷佳一次性介入器械");
  assert.equal(HunanValues[2][12].split(" + ").at(-1), "耗材名称：昕敷佳一次性介入器械");
  assert.equal(HunanValues[2][11], medication);

  const missingSegment = recordsForHunan.map((record, index) => index === 1
    ? { ...record, prescriptionList: medicationPrescription }
    : record);
  await fs.writeFile(recordsPath, JSON.stringify(missingSegment, null, 2));
  await assert.rejects(run(process.execPath, hunanArgs), /必须以耗材名称：昕敷佳一次性介入器械结尾/);

  const duplicateSegment = recordsForHunan.map((record, index) => index === 1
    ? { ...record, prescriptionList: `${record.prescriptionList} + 耗材名称：昕敷佳一次性介入器械` }
    : record);
  await fs.writeFile(recordsPath, JSON.stringify(duplicateSegment, null, 2));
  await assert.rejects(run(process.execPath, hunanArgs), /耗材段不得重复/);

  const misplacedSegment = recordsForHunan.map((record, index) => index === 1
    ? { ...record, prescriptionList: `耗材名称：昕敷佳一次性介入器械 + ${medicationPrescription}` }
    : record);
  await fs.writeFile(recordsPath, JSON.stringify(misplacedSegment, null, 2));
  await assert.rejects(run(process.execPath, hunanArgs), /必须以耗材名称：昕敷佳一次性介入器械结尾/);
  console.log(JSON.stringify({ status: "passed", suite: "company device consumable" }));
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
