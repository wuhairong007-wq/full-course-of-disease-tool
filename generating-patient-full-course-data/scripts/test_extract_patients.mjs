import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { loadArtifactTool } from "./lib/artifact_tool.mjs";

const run = promisify(execFile);
const { Workbook, SpreadsheetFile } = await loadArtifactTool();
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "patient-symptoms-"));
const script = fileURLToPath(new URL("./extract_patients.mjs", import.meta.url));
const required = ["userid", "激活时间", "性别", "年龄", "疾病", "产品名称", "产品类型", "既往过敏史"];
const base = ["U001", "2026-09-01 08:00:00", "女", 50, "原发性膝骨关节炎", "硫酸氨基葡萄糖胶囊", "用药", "青霉素过敏"];

async function extract(name, headers, rows) {
  const workbook = Workbook.create();
  const sheet = workbook.worksheets.add("患者");
  sheet.getRangeByIndexes(0, 0, rows.length + 1, headers.length).values = [headers, ...rows];
  const input = path.join(temp, `${name}.xlsx`);
  const output = path.join(temp, `${name}.json`);
  await (await SpreadsheetFile.exportXlsx(workbook)).save(input);
  await run(process.execPath, [script, "--input", input, "--output", output]);
  return JSON.parse(await fs.readFile(output, "utf8"));
}

try {
  const patients = await extract("symptoms", [...required, "疼痛程度", "疼痛评分", "炎症表现", "症状描述", "患者标签"], [
    [...base, "中度", 5, "关节肿胀", "活动时疼痛", "高度"],
    ["U002", ...base.slice(1), "无痛", 0, "无红肿", "无晨僵", "高度"],
    ["U003", ...base.slice(1), "", null, "  ", null, "高度"],
  ]);
  assert.deepEqual(patients[0].symptomEvidence, {
    疼痛程度: "中度", 疼痛评分: "5", 炎症表现: "关节肿胀", 症状描述: "活动时疼痛",
  });
  assert.deepEqual(patients[1].symptomEvidence, {
    疼痛程度: "无痛", 疼痛评分: "0", 炎症表现: "无红肿", 症状描述: "无晨僵",
  });
  assert.equal("symptomEvidence" in patients[2], false, "空症状不得随机补全或由高度患者标签推断");
  assert.deepEqual(patients.map(p => p.userid), ["U001", "U002", "U003"]);
  assert(patients.every(p => p.allergyHistory === "青霉素过敏"));
  const legacy = await extract("legacy", required, [base]);
  assert.equal("symptomEvidence" in legacy[0], false);
  assert.equal(legacy[0].age, 50);
  const context = await extract("clinical-context", [...required, "合并疾病", "当前用药", "肾功能", "妊娠状态"], [
    [...base, "高血压", "氨氯地平片", "异常", "否"],
    ["U002", ...base.slice(1), "", null, "", null],
  ]);
  assert.deepEqual(context[0].clinicalContext, { 合并疾病: "高血压", 当前用药: "氨氯地平片", 肾功能: "异常", 妊娠状态: "否" });
  assert.equal("clinicalContext" in context[1], false);
  assert.equal("clinicalContext" in legacy[0], false);
  console.log(JSON.stringify({ status: "passed", cases: 6 }));
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
