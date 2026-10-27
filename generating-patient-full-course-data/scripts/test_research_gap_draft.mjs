import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { loadArtifactTool } from "./lib/artifact_tool.mjs";

const run = promisify(execFile);
const { Workbook, FileBlob, SpreadsheetFile } = await loadArtifactTool();
const root = fileURLToPath(new URL("../", import.meta.url));
const temp = await fs.mkdtemp(path.join(os.tmpdir(), "research-gap-draft-"));
const input = path.join(temp, "source.xlsx");
const output = path.join(temp, "患者明细_模拟_待核实.xlsx");
const reviewPath = path.join(temp, "review.json");
const recordsPath = path.join(temp, "records.json");
const preview = path.join(temp, "preview.png");
const headers = [
  "序号", "userid", "患者姓名", "激活时间", "性别", "年龄", "疾病", "手机号码", "地区",
  "患者标签", "既往过敏史", "产品名称", "产品类型", "关联厂家用药",
];
const rows = [
  [1, "draft-1", "甲", "2026-10-01 08:00:00", "女", 40, "测试疾病甲", null, null, "无", "无", "测试产品", "用药", ""],
  [2, "draft-2", "乙", "2026-10-01 09:00:00", "男", 60, "测试疾病乙", null, null, "轻度", "青霉素过敏", "测试产品", "用药", ""],
];
const replace = (args, key, value) => {
  const changed = [...args];
  changed[changed.indexOf(key) + 1] = value;
  return changed;
};
try {
  const source = Workbook.create();
  source.worksheets.add("患者").getRange("A1:N3").values = [headers, ...rows];
  source.recalculate();
  await (await SpreadsheetFile.exportXlsx(source)).save(input);
  const sourceBytes = await fs.readFile(input);
  const template = path.join(root, "assets/patient-full-course-template.xlsx");
  const templateBytes = await fs.readFile(template);
  const review = {
    kind: "fictional-draft-review/v1",
    sourceSHA256: crypto.createHash("sha256").update(sourceBytes).digest("hex"),
    searchedOn: "2026-10-26",
    queries: ["测试产品 说明书 规格 剂量 频次 疗程"],
    sources: [{ title: "合成检索记录", url: "https://example.com/synthetic", finding: "仅用于测试审计结构，并非临床资料" }],
    unresolved: rows.map(row => ({ userid: row[1], parameters: ["适用性", "规格", "剂量", "频次", "疗程"], reason: "合成测试缺口" })),
  };
  await fs.writeFile(reviewPath, JSON.stringify(review));
  const command = [
    path.join(root, "scripts/build_workbook.mjs"),
    "--input", input, "--review", reviewPath, "--template", template,
    "--output", output, "--mode", "fictional-draft", "--preview", preview,
  ];
  const result = await run(process.execPath, command);
  const summary = JSON.parse(result.stdout.trim().split("\n").at(-1));
  assert.equal(summary.status, "draft");
  assert.equal(summary.clinicalValidation, "not-completed");
  assert.equal(summary.patients, rows.length);
  assert.equal(summary.unresolvedPatients, rows.length);
  const saved = await SpreadsheetFile.importXlsx(await FileBlob.load(output));
  assert.equal(saved.worksheets.items.length, 1);
  const sheet = saved.worksheets.getItemAt(0);
  assert.equal(sheet.tables.items.length, 1);
  const values = sheet.getUsedRange(true).values;
  assert.deepEqual(values[0], [...headers.slice(0, 11), "关联厂家用药", "处方清单", "手术名称", "耗材名称", "全病程方案名称"]);
  assert.equal(values.length, rows.length + 1);
  values.slice(1).forEach((row, index) => {
    assert.deepEqual(row.slice(0, 11), rows[index].slice(0, 11).map((value, column) => column === 9 && value === "无" ? "正常" : value));
    assert(row.slice(11, 15).every(value => value === null || value === ""));
    assert.equal(row[15], rows[index][6]);
    assert.doesNotMatch(row.slice(11).join(" "), /模拟|虚构|未提供|待核实/);
  });
  assert((await fs.stat(preview)).size > 0);
  const previous = await fs.readFile(output);
  await assert.rejects(run(process.execPath, replace(command, "--output", path.join(temp, "患者明细_模拟.xlsx"))), /文件名必须同时包含/);
  await assert.rejects(run(process.execPath, replace(command, "--output", input)), /不得覆盖/);
  await assert.rejects(run(process.execPath, [...command, "--min-medications", "1"]), /草稿不适用最少种数/);
  await fs.writeFile(recordsPath, "[]");
  await assert.rejects(run(process.execPath, [...command, "--records", recordsPath]), /草稿不得提交处方记录/);
  for (const mode of ["real", "fictional-test"]) {
    await assert.rejects(run(process.execPath, [...replace(command, "--mode", mode), "--records", recordsPath]), /草稿审核不能用于完整处方模式/);
  }
  for (const invalid of [
    { ...review, sourceSHA256: "0".repeat(64) },
    { ...review, sources: [] },
    { ...review, queries: [] },
    { ...review, unresolved: review.unresolved.slice(1) },
    { ...review, unresolved: [...review.unresolved, review.unresolved[0]] },
    { ...review, searchedOn: "2026-02-30" },
    { ...review, unresolved: [{ ...review.unresolved[0], parameters: [] }, review.unresolved[1]] },
  ]) {
    await fs.writeFile(reviewPath, JSON.stringify(invalid));
    await assert.rejects(run(process.execPath, command));
    assert.deepEqual(await fs.readFile(output), previous);
  }
  assert.deepEqual(await fs.readFile(input), sourceBytes);
  assert.deepEqual(await fs.readFile(template), templateBytes);
  console.log(JSON.stringify({ status: "passed", suite: "research gap draft", patients: rows.length }));
} finally {
  await fs.rm(temp, { recursive: true, force: true });
}
