import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { loadArtifactTool } from "./lib/artifact_tool.mjs";
import { generateFictionalRecords } from "./fictional_test_mode.mjs";

const run = promisify(execFile);
const { Workbook, FileBlob, SpreadsheetFile } = await loadArtifactTool();
const root = fileURLToPath(new URL("../", import.meta.url));
const skillRoot = root;
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "manufacturer-medication-"));
const product = "硫酸氨基葡萄糖胶囊";
const disease = "原发性膝骨关节炎";
const prescription = `${product} 规格0.25g/粒；每次用量0.5g；口服，每日3次，餐后；连续30天；观察皮疹`;
const headers = ["序号", "userid", "患者姓名", "激活时间", "性别", "年龄", "疾病", "手机号码", "地区",
  "患者标签", "既往过敏史", "产品名称", "产品类型", "关联厂家用药"];
const sourceRows = [1, 2].map(sequence => [
  sequence, `U00${sequence}`, "测试", "2026-09-01 08:00:00", "女", 40, disease, "", "江苏省",
  "中度", "无", product, "用药", "旧值不得替代当前产品",
]);
const input = path.join(temp, "source.xlsx");
const output = path.join(temp, "details.xlsx");
const recordsPath = path.join(temp, "records.json");
const reviewPath = path.join(temp, "review.json");
const command = async (script, args) => run(process.execPath, [path.join(root, "scripts", script), ...args]);
const readRows = async filename => (await SpreadsheetFile.importXlsx(await FileBlob.load(filename)))
  .worksheets.getItemAt(0).getUsedRange(true).values;
const source = Workbook.create();
const sheet = source.worksheets.add("患者");
const saveSource = async () => {
  sheet.getRangeByIndexes(0, 0, sourceRows.length + 1, headers.length).values = [headers, ...sourceRows];
  await (await SpreadsheetFile.exportXlsx(source)).save(input);
};
const realRecords = sourceRows.map(row => ({
  userid: row[1], allergyHistory: "无", combinedMedication: [product], prescriptionList: prescription,
  surgeryName: "", consumableName: "", coursePlanName: `${disease}治疗管理方案`,
}));
const reviews = realRecords.map(record => ({
  userid: record.userid,
  roles: ["产品", "病因/一线治疗", "维持治疗", "围手术期治疗", "症状支持"].map(role => ({
    role, evidence: [{ field: "疾病", value: disease }], rationale: "合成测试，仅验证厂家单药导出约束",
    candidates: role === "产品" ? [{
      medication: product, indication: "测试当前产品", safetyAssessment: "合成成年无过敏数据",
      eligible: true, selected: true, exclusionReason: "",
    }] : [],
    exclusionReason: role === "产品" ? "" : "本次只组织关联厂家药品，不代表完整临床治疗",
  })),
}));
const buildArgs = ["--input", input, "--records", recordsPath, "--review", reviewPath,
  "--template", path.join(root, "assets/patient-full-course-template.xlsx"), "--output", output,
  "--company", "山东利赛医药有限公司"];

try {
  const manufacturerInstructions = await fs.readFile(path.join(skillRoot, "references/manufacturer-medication.md"), "utf8");
  const fictionalInstructions = await fs.readFile(path.join(skillRoot, "references/fictional-test-mode.md"), "utf8");
  assert.match(manufacturerInstructions, /患者.*疾病.*年龄.*性别/s);
  assert.match(manufacturerInstructions, /差异.*说明书|说明书.*差异/s);
  assert.match(manufacturerInstructions, /相同处方.*允许|允许.*相同处方/s);
  assert.match(fictionalInstructions, /不得.*强制.*剂量|不得.*为.*差异.*改.*剂量/s);

  const ageSpecificCatalog = {
    kind: "fictional-medication-catalog/v1",
    id: "manufacturer-age-boundary-test",
    reviewedOn: "2026-10-19",
    scope: {
      diseases: [disease], productName: product, productType: "用药", minAge: 18, maxAge: 80,
      allergyHistories: ["无"], evidenceMatches: {},
    },
    planSuffix: "测试方案",
    assumptions: ["测试情境；不代表真实用药建议"],
    sources: [{ name: "测试说明书", url: "https://example.com/label", scope: "测试边界" }],
    drugs: {
      product: {
        name: product, role: "产品", specification: "0.25g/粒", dose: "0.5g（2粒）",
        route: "口服", frequency: "每日3次", timing: "三餐时服用", warnings: "出现过敏反应及时就医。",
        sourceIds: [0],
      },
    },
    variants: [
      { id: "younger-adult", assumption: "年龄18至49岁", minAge: 18, maxAge: 49,
        excludedAllergies: [], medications: [{ drug: "product", days: 30 }] },
      { id: "older-adult", assumption: "年龄50至80岁", minAge: 50, maxAge: 80,
        excludedAllergies: [], medications: [{ drug: "product", days: 42 }] },
    ],
  };
  const fictionalPatients = [
    { userid: "YOUNG", gender: "女", age: 40, disease, productName: product, productType: "用药",
      allergyHistory: "无", medicationColumn: "关联厂家用药" },
    { userid: "OLDER", gender: "男", age: 65, disease, productName: product, productType: "用药",
      allergyHistory: "无", medicationColumn: "关联厂家用药" },
  ];
  const ageSpecificRun = generateFictionalRecords({
    patients: fictionalPatients, catalog: ageSpecificCatalog, minimumMedications: 1,
  });
  assert.match(ageSpecificRun.records[0].prescriptionList, /疗程30天/);
  assert.match(ageSpecificRun.records[1].prescriptionList, /疗程42天/);
  const overlappingCatalog = structuredClone(ageSpecificCatalog);
  overlappingCatalog.variants[1].minAge = 18;
  assert.throws(() => generateFictionalRecords({
    patients: fictionalPatients.map(patient => ({ ...patient, age: 40 })),
    catalog: overlappingCatalog,
    minimumMedications: 1,
  }), /多个不同.*剂量或疗程/);

  await saveSource();
  const originalBytes = await fs.readFile(input);
  await command("extract_patients.mjs", ["--input", input, "--output", path.join(temp, "extracted.json")]);
  const extracted = JSON.parse(await fs.readFile(path.join(temp, "extracted.json"), "utf8"));
  assert(extracted.every(patient => patient.medicationColumn === "关联厂家用药"));
  await fs.writeFile(recordsPath, JSON.stringify(realRecords));
  await fs.writeFile(reviewPath, JSON.stringify(reviews));
  const result = await command("build_workbook.mjs", buildArgs);
  assert.deepEqual(await fs.readFile(input), originalBytes);
  assert.equal(JSON.parse(result.stdout.trim().split("\n").at(-1)).minimumMedications, 1);
  const details = await readRows(output);
  assert.equal(details[0][11], "关联厂家用药");
  assert.deepEqual(details.slice(1).map(row => row[11]), [product, product]);
  const reopened = await SpreadsheetFile.importXlsx(await FileBlob.load(output));
  assert.equal(reopened.worksheets.items.length, 1);
  assert.equal(reopened.worksheets.getItemAt(0).tables.items.length, 1);
  assert.equal(reopened.worksheets.getItemAt(0).tables.items[0].columnNames[11], "关联厂家用药");
  const validOutputBytes = await fs.readFile(output);
  await assert.rejects(command("build_workbook.mjs", [...buildArgs, "--min-medications", "3"]), /只能.*1/);
  await fs.writeFile(recordsPath, JSON.stringify(realRecords.map(record => ({
    ...record, combinedMedication: [product, "对乙酰氨基酚片"],
  }))));
  await assert.rejects(command("build_workbook.mjs", buildArgs), /当前产品名称/);
  await fs.writeFile(recordsPath, JSON.stringify(realRecords));
  sourceRows[0][10] = `${product}过敏`;
  realRecords[0].allergyHistory = sourceRows[0][10];
  await saveSource();
  await fs.writeFile(recordsPath, JSON.stringify(realRecords));
  await assert.rejects(command("build_workbook.mjs", buildArgs), /过敏.*冲突/);
  sourceRows[0][10] = "无";
  realRecords[0].allergyHistory = "无";
  sourceRows[0][12] = "器械";
  await saveSource();
  await fs.writeFile(recordsPath, JSON.stringify(realRecords));
  await assert.rejects(command("build_workbook.mjs", buildArgs), /器械/);
  sourceRows[0][12] = "用药";
  await saveSource();
  assert.deepEqual(await fs.readFile(output), validOutputBytes);

  for (const columns of [16, 17, 18]) {
    const legacyInput = path.join(temp, `details-${columns}.xlsx`);
    const workbook = Workbook.create();
    const legacyRows = details.map(row => {
      if (columns === 16) return row;
      const values = columns === 17 ? row.filter((_, index) => index !== 14) : [...row];
      return [...values, ...(row === details[0] ? ["AI状态", "确认状态"] : ["已生成", "已确认"])];
    });
    workbook.worksheets.add("患者").getRangeByIndexes(0, 0, legacyRows.length, columns).values = legacyRows;
    await (await SpreadsheetFile.exportXlsx(workbook)).save(legacyInput);
    for (const [script, extra] of [
      ["extract_health_plan_patients.mjs", []],
      ["extract_medication_tracking_patients.mjs", ["--service-start", "2026-09-01", "--service-end", "2026-09-30"]],
      ["extract_adverse_reaction_patients.mjs", ["--count", "2"]],
    ]) {
      const extractedPath = path.join(temp, `${columns}-${script}.json`);
      await command(script, ["--input", legacyInput, "--output", extractedPath, ...extra]);
      const patients = JSON.parse(await fs.readFile(extractedPath, "utf8"));
      assert.deepEqual(patients.map(patient => patient.userid), ["U001", "U002"]);
      assert(patients.every(patient => JSON.stringify(patient.combinedMedication) === JSON.stringify([product])
        || patient.combinedMedication === product));
      if (script.includes("adverse")) assert(patients.every(patient => patient.productName === product));
    }
  }

  const trackingRecords = realRecords.map(record => ({
    userid: record.userid,
    medicationPlan: `针对40岁女性${disease}，${product}每日3次餐后使用，观察皮疹并复诊核对。`,
    medicationCycle: `${product}连续30天，疗程结束后复诊。`,
    medicationItems: [{
      drugName: product, specification: "0.25g/粒", singleDose: "0.5g", frequency: "每日3次",
      medicationTime: "餐后", treatmentDays: 30,
      precautions: [
        "饮食禁忌：餐后使用，食物限制使用前咨询药师。",
        "合并用药：如正在服用其他药品，使用前咨询医生或药师核对相互作用。",
        "用药观察：观察皮疹，出现异常及时就医。",
        "储存保存：保留原包装，按药盒标示条件保存，置于儿童不能接触处并检查有效期。",
      ].join("\n"),
    }],
  }));
  const tracking = path.join(temp, "tracking.xlsx");
  const medicationList = path.join(temp, "medications.xlsx");
  await fs.writeFile(recordsPath, JSON.stringify(trackingRecords));
  await command("build_medication_tracking_workbooks.mjs", [
    "--input", output, "--records", recordsPath, "--service-start", "2026-09-01", "--service-end", "2026-09-30",
    "--tracking-template", path.join(root, "assets/medication-tracking-template.xlsx"),
    "--medication-template", path.join(root, "assets/medication-list-template.xlsx"),
    "--tracking-output", tracking, "--medication-output", medicationList,
  ]);
  const trackingRows = await readRows(tracking);
  const expectedTrackingHeaders = [
    "序号", "患者ID", "姓名", "性别", "年龄", "疾病", "既往过敏史",
    "体温监测次数", "血压、心率监测次数", "用药提醒次数", "用药方案",
    "用药周期", "方案链接", "患者响应率", "是否触发人工干预",
  ];
  assert.deepEqual(trackingRows[0], expectedTrackingHeaders);
  const trackingSaved = await SpreadsheetFile.importXlsx(await FileBlob.load(tracking));
  const trackingTables = trackingSaved.worksheets.getItemAt(0).tables.items;
  assert.equal(trackingTables.length, 1);
  assert.deepEqual(trackingTables[0].columnNames, expectedTrackingHeaders);
  assert(trackingRows.slice(1).every(row => row.length === 15 && Number.isInteger(row[7])));
  assert.deepEqual(trackingRows.slice(1).map(row => row[10]), trackingRecords.map(record => record.medicationPlan));
  assert.deepEqual(trackingRows.slice(1).map(row => row[11]), trackingRecords.map(record => record.medicationCycle));
  const medicationRows = (await readRows(medicationList)).slice(1);
  assert.deepEqual(medicationRows.map(row => row[2]), [product, product]);
  assert.deepEqual(medicationRows.map(row => row[8]), trackingRecords.map(record => record.medicationItems[0].precautions));

  const adverseRecords = realRecords.map(record => ({
    userid: record.userid, symptomDescription: "出现轻微皮疹和瘙痒。",
    treatmentMeasures: "记录皮疹变化并联系临床服务评估。",
    outcome: "继续观察，安排复诊。",
    remarks: "出现呼吸困难或皮疹加重立即就医。",
  }));
  await fs.writeFile(recordsPath, JSON.stringify(adverseRecords));
  const adverseOutput = path.join(temp, "adverse.xlsx");
  const adverseArgs = ["--input", output, "--records", recordsPath, "--count", "2",
    "--template", path.join(root, "assets/adverse-reaction-list-template.xlsx"), "--output", adverseOutput];
  await command("build_adverse_reaction_workbook.mjs", adverseArgs);
  assert.equal((await readRows(adverseOutput)).length, 3);
  adverseRecords[0].symptomDescription = `${product}使用期间出现皮疹。`;
  await fs.writeFile(recordsPath, JSON.stringify(adverseRecords));
  await assert.rejects(command("build_adverse_reaction_workbook.mjs", adverseArgs), /当前产品信息/);

  const fictionalOutput = path.join(temp, "details_模拟.xlsx");
  const fictionalSourceBytes = await fs.readFile(input);
  await command("generate_fictional_test_records.mjs", [
    "--mode", "fictional-test", "--input", input, "--records", recordsPath, "--review", reviewPath,
    "--company", "山东利赛医药有限公司",
  ]);
  const fictionalRecords = JSON.parse(await fs.readFile(recordsPath, "utf8"));
  assert(fictionalRecords.every(record => JSON.stringify(record.combinedMedication) === JSON.stringify([product])));
  const fictionalArgs = [...buildArgs];
  fictionalArgs[fictionalArgs.indexOf("--output") + 1] = fictionalOutput;
  await command("build_workbook.mjs", [...fictionalArgs, "--mode", "fictional-test"]);
  assert.equal((await readRows(fictionalOutput))[0][11], "关联厂家用药");
  assert.deepEqual((await readRows(fictionalOutput)).slice(1).map(row => row[11]), [product, product]);
  assert.equal(sourceRows[0][13], "旧值不得替代当前产品");
  assert.deepEqual(await fs.readFile(input), fictionalSourceBytes);
  console.log(JSON.stringify({ status: "passed", suite: "manufacturer medication workflow", layouts: [16, 17, 18] }));
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
