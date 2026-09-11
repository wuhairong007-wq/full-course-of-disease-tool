import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { loadArtifactTool } from "./lib/artifact_tool.mjs";

// Synthetic export fixtures only; these tests do not establish clinical suitability.
const run = promisify(execFile);
const { Workbook, FileBlob, SpreadsheetFile } = await loadArtifactTool();
const root = fileURLToPath(new URL("../", import.meta.url));
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "stage1-output-contract-"));
const output = path.join(temp, "patients.xlsx");
const template = path.join(root, "assets/patient-full-course-template.xlsx");
const sourceHeaders = ["序号", "userid", "患者姓名", "激活时间", "性别", "年龄", "疾病", "手机号码", "地区", "患者标签", "既往过敏史", "产品名称", "产品类型"];
const expectedHeaders = [...sourceHeaders.slice(0, 11), "联合用药", "处方清单", "手术名称", "全病程方案名称", "AI状态", "确认状态"];
const rows = ["U001", "U002"].map((id, i) => [i + 1, id, "测试", "2026-09-01 08:00:00", "男", 60, "原发性高血压", null, null, "无", "无", "缬沙坦胶囊", "用药"]);
const prescriptions = [
  ["缬沙坦胶囊", "缬沙坦胶囊 规格80mg/粒，每次80mg，口服，每日1次，早餐后服用，连续28天"],
  ["苯磺酸氨氯地平片", "苯磺酸氨氯地平片 规格5mg/片，每次5mg，口服，每日1次，早餐后服用，连续28天"],
  ["氢氯噻嗪片", "氢氯噻嗪片 规格25mg/片，每次12.5mg，口服，每日1次，早餐后服用，连续28天"],
];
const args = [path.join(root, "scripts/build_workbook.mjs"),
  "--input", path.join(temp, "source.xlsx"), "--records", path.join(temp, "records.json"),
  "--review", path.join(temp, "review.json"), "--template", template, "--output", output];
async function writeFixtures(counts, excludeProduct = false) {
  const records = rows.map((row, i) => ({
    userid: row[1], allergyHistory: "无",
    combinedMedication: prescriptions.slice(0, counts[i]).map(p => p[0]),
    prescriptionList: prescriptions.slice(0, counts[i]).map(p => p[1]).join(" + "),
    surgeryName: "", coursePlanName: "原发性高血压管理方案",
  }));
  const reviews = records.map(record => ({ userid: record.userid, roles:
    ["产品", "病因/一线治疗", "维持治疗", "围手术期治疗", "症状支持"].map(role => {
      const medications = role === "病因/一线治疗" ? record.combinedMedication.filter(name => !(excludeProduct && name === prescriptions[0][0])) : [];
      return {role, evidence: [{field: "疾病", value: "原发性高血压"}],
        rationale: "导出行为测试夹具，不作为患者的临床判断依据。",
        candidates: medications.map(medication => ({medication, indication: "测试夹具中的治疗用途",
          safetyAssessment: "只测试导出契约，不验证临床安全性。", eligible: true, selected: true, exclusionReason: ""})),
        exclusionReason: medications.length ? "" : "测试夹具中该用途不选药"};
    })}));
  await fs.writeFile(path.join(temp, "records.json"), JSON.stringify(records));
  await fs.writeFile(path.join(temp, "review.json"), JSON.stringify(reviews));
}
try {
  const source = Workbook.create();
  source.worksheets.add("患者").getRange("A1:M3").values = [sourceHeaders, ...rows];
  await (await SpreadsheetFile.exportXlsx(source)).save(path.join(temp, "source.xlsx"));
  await writeFixtures([1, 2]);
  await assert.rejects(run(process.execPath, [...args, "--min-medications", "3"]), error => {
    assert.match(error.stderr, /最少种数3/);
    assert.match(error.stderr, /U001.*实际1种/);
    assert.match(error.stderr, /U002.*实际2种/);
    return true;
  });
  await assert.rejects(fs.access(output));

  await writeFixtures([3, 3]);
  const result = await run(process.execPath, [...args, "--company", "江苏壹号畅达药业有限公司", "--min-medications", "3"]);
  const summary = JSON.parse(result.stdout.trim().split("\n").at(-1));
  assert.equal(summary.minimumMedications, 3);
  assert.equal(summary.minimumActualMedications, 3);
  const saved = await SpreadsheetFile.importXlsx(await FileBlob.load(output));
  assert.equal(saved.worksheets.items.length, 1);
  const sheet = saved.worksheets.getItemAt(0);
  const values = sheet.getUsedRange(true).values;
  assert.deepEqual(values[0], expectedHeaders);
  assert.equal(values.length, 3);
  assert.equal(sheet.tables.items.length, 1);
  values.slice(1).forEach((row, i) => {
    assert.deepEqual(row.slice(0, 11), rows[i].slice(0, 11));
    assert.equal(row[11].split("+").length, 3);
    assert.equal(row[12].split(" + ").length, 3);
    assert.deepEqual(row.slice(15), ["已生成", "待确认"]);
  });
  const previousBytes = await fs.readFile(output);
  await writeFixtures([1, 2]);
  await assert.rejects(run(process.execPath, [...args, "--min-medications", "3"]), /最少种数3/);
  assert.deepEqual(await fs.readFile(output), previousBytes);
  for (const invalid of ["0", "6", "2.5"]) {
    await assert.rejects(run(process.execPath, [...args, "--min-medications", invalid]), /1.*5.*整数/);
    assert.deepEqual(await fs.readFile(output), previousBytes);
  }
  await writeFixtures([3, 3], true);
  await assert.rejects(run(process.execPath, [...args, "--company", "山东利赛医药有限公司", "--min-medications", "3"]), /U001.*实际2种/);
  assert.deepEqual(await fs.readFile(output), previousBytes);

  await writeFixtures([3, 3]);
  const wrongTemplate = await SpreadsheetFile.importXlsx(await FileBlob.load(template));
  wrongTemplate.worksheets.getItemAt(0).getRange("R1").values = [["评估结论"]];
  const wrongPath = path.join(temp, "wrong-template.xlsx");
  await (await SpreadsheetFile.exportXlsx(wrongTemplate)).save(wrongPath);
  const wrongArgs = [...args]; wrongArgs[wrongArgs.indexOf("--template") + 1] = wrongPath;
  await assert.rejects(run(process.execPath, wrongArgs), /固定17列表头/);
  assert.deepEqual(await fs.readFile(output), previousBytes);
  const extraSheetTemplate = await SpreadsheetFile.importXlsx(await FileBlob.load(template));
  extraSheetTemplate.worksheets.add("候选评估").getRange("A1").values = [["评估结果"]];
  await (await SpreadsheetFile.exportXlsx(extraSheetTemplate)).save(wrongPath);
  await assert.rejects(run(process.execPath, wrongArgs), /不能附加评估工作表/);
  assert.deepEqual(await fs.readFile(output), previousBytes);
  console.log(JSON.stringify({status: "passed", suite: "stage1 output contract", cases: 9}));
} finally {
  await fs.rm(temp, {recursive: true, force: true});
}
