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
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "review-export-"));
const output = path.join(temp, "output.xlsx");
const args = [path.join(root, "scripts/build_workbook.mjs"),
  "--input", path.join(temp, "input.xlsx"), "--records", path.join(temp, "records.json"),
  "--template", path.join(root, "assets/patient-full-course-template.xlsx"), "--output", output];
try {
  await assert.rejects(run(process.execPath, args), /缺少参数：--review/);
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("患者");
  sheet.getRange("A1:M2").values = [
    ["序号", "userid", "患者姓名", "激活时间", "性别", "年龄", "疾病", "手机号码", "地区", "患者标签", "既往过敏史", "产品名称", "产品类型"],
    [1, "U001", "测试", "2026-09-01 08:00:00", "女", 40, "原发性膝骨关节炎", "", "", "无", "无", "硫酸氨基葡萄糖胶囊", "用药"],
  ];
  await (await SpreadsheetFile.exportXlsx(workbook)).save(args[2]);
  const record = { userid: "U001", allergyHistory: "无", combinedMedication: ["硫酸氨基葡萄糖胶囊"],
    prescriptionList: "硫酸氨基葡萄糖胶囊 规格0.25g/粒，每次0.5g，口服，每日3次，餐后服用，连续84天",
    surgeryName: "", coursePlanName: "原发性膝骨关节炎保守治疗方案" };
  await fs.writeFile(args[4], JSON.stringify([record]));
  const review = { userid: "U001", roles: ["产品", "病因/一线治疗", "维持治疗", "围手术期治疗", "症状支持"].map(role => ({
    role, evidence: [{ field: "疾病", value: "原发性膝骨关节炎" }], rationale: "仅用于导出流程测试，实际生成需临床依据",
    candidates: [], exclusionReason: "测试场景没有独立治疗用途",
  })) };
  review.roles[0].candidates = [{ medication: record.combinedMedication[0], indication: "保留输入产品候选",
    safetyAssessment: "测试数据：成年且原表无过敏史", eligible: true, selected: true, exclusionReason: "" }];
  review.roles[0].exclusionReason = "";
  const reviewPath = path.join(temp, "review.json");
  const withReview = [...args, "--review", reviewPath];
  review.roles[0].evidence[0].value = "虚构疼痛";
  await fs.writeFile(reviewPath, JSON.stringify([review]));
  await assert.rejects(run(process.execPath, withReview), /原表事实/);
  await assert.rejects(fs.access(output));
  review.roles[0].evidence[0].value = "原发性膝骨关节炎";
  await fs.writeFile(reviewPath, JSON.stringify([review]));
  await run(process.execPath, withReview);
  const saved = await SpreadsheetFile.importXlsx(await FileBlob.load(output));
  assert.equal(saved.worksheets.getItemAt(0).getRange("L2").values[0][0], record.combinedMedication[0]);
  const previousBytes = await fs.readFile(output);
  review.roles[0].candidates[0].eligible = false;
  await fs.writeFile(reviewPath, JSON.stringify([review]));
  await assert.rejects(run(process.execPath, withReview), /不可选/);
  assert.deepEqual(await fs.readFile(output), previousBytes);
  console.log(JSON.stringify({ status: "passed", suite: "review export", cases: 4 }));
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
