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
const { Workbook, SpreadsheetFile } = await import(pathToFileURL(artifactToolPath).href);
const scriptDir = path.dirname(new URL(import.meta.url).pathname);
const skillDir = path.resolve(scriptDir, "..");
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "health-plan-richness-"));
const sourcePath = path.join(tempDir, "source.xlsx");
const recordsPath = path.join(tempDir, "records.json");
const outputPath = path.join(tempDir, "output.xlsx");
const headers = [
  "序号", "userid", "患者姓名", "激活时间", "性别", "年龄", "疾病", "手机号码", "地区",
  "患者标签", "既往过敏史", "联合用药", "处方清单", "手术名称", "全病程方案名称", "AI状态", "确认状态",
];
const row = [1, "U-RICH", "甲*", "2026-08-01 10:00:00", "男", 45, "慢性胃炎", "", "", "稳定期", "无", "奥美拉唑肠溶胶囊", "奥美拉唑肠溶胶囊 规格20mg/粒，每次20mg，口服，每日1次，早餐前服用，连续14天", "", "慢性胃炎随访方案", "已生成", "已确认"];
const genericRecord = {
  userid: "U-RICH",
  aiManagerIntro: "你好！我是您的AI健康管理师，我将为您提供全面专业的疾病管理支持，从病情监测、症状观察、用药管理到复诊规划，协助您更安全、有序地推进康复与长期管理。针对您的【慢性胃炎治疗与随访阶段】，我将结合“慢性胃炎随访方案”，为您梳理已审核治疗和每日关注重点，帮助您理解并参与管理过程。",
  aiMedicalRecord: "就诊科室：消化内科\n就诊日期：2026年8月1日\n处置：围绕慢性胃炎和已审核用药方案开展管理。",
  treatmentPlan: "• 奥美拉唑肠溶胶囊：按审核处方使用\n——【核心治疗·药物治疗】",
  aiPharmacology: "奥美拉唑肠溶胶囊属于抑酸药，用于慢性胃炎，注意遵医嘱使用。",
  aiHealthPlan: "① 用药管理：按方案用药。\n② 症状观察：关注变化。\n③ 生活管理：保持规律。",
  monitoringIndicators: "症状：每日记录\n进食：每日观察\n药物耐受：每日观察\n复诊：按医生安排",
  lifestyleAvoid: "• 避免饮酒\n• 避免暴饮暴食\n• 避免自行加药\n• 避免延长疗程",
  lifestyleRecommend: "• 规律进餐\n• 记录症状\n• 按时用药\n• 按计划复诊",
  followupPlan: "• 疗程结束后复诊\n• 症状加重时提前就医",
  emergencyReminder: "⚠ 呕血或黑便\n⚠ 剧烈腹痛\n⚠ 持续呕吐\n⚠ 晕厥\n⚠ 立即就医。",
};
const workbook = Workbook.create();
workbook.worksheets.add("Sheet1").getRange("A1:Q2").values = [headers, row];
await (await SpreadsheetFile.exportXlsx(workbook)).save(sourcePath);
await fs.writeFile(recordsPath, JSON.stringify([genericRecord], null, 2));
const result = spawnSync(process.execPath, [
  path.join(scriptDir, "build_health_plan_workbook.mjs"),
  "--input", sourcePath, "--records", recordsPath,
  "--template", path.join(skillDir, "assets", "health-management-plan-template.xlsx"),
  "--output", outputPath,
], { encoding: "utf8", env: { ...process.env, CODEX_NODE_MODULES: nodeModules } });
assert.notEqual(result.status, 0, "泛化药理和三条概述式健康方案不应通过校验");
assert.match(`${result.stdout}\n${result.stderr}`, /药理科普|健康管理方案/);
console.log(JSON.stringify({ status: "passed", observedFailure: true }));
