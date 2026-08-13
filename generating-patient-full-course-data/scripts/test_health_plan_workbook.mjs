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
const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "patient-health-plan-skill-"));
const sourcePath = path.join(tempDir, "审核后患者明细.xlsx");
const extractedPath = path.join(tempDir, "patients.json");
const recordsPath = path.join(tempDir, "records.json");
const outputPath = path.join(tempDir, "健康管理方案_生成.xlsx");
const templatePath = path.join(skillDir, "assets", "health-management-plan-template.xlsx");

const sourceHeaders = [
  "序号", "userid", "患者姓名", "激活时间", "性别", "年龄", "疾病", "手机号码", "地区",
  "患者标签", "既往过敏史", "联合用药", "处方清单", "手术名称", "全病程方案名称", "AI状态", "确认状态",
];
const sourceRows = [
  [1, "U001", "甲*", "2026-08-01 10:00:00", "男", 70, "心房颤动伴缓慢心室率", "130****0001", "江苏省南京市", "术后随访", "无", "华法林钠片+对乙酰氨基酚片", "华法林钠片 规格2.5mg/片，每次2.5mg，口服，每日1次，晚餐中服用，疗程至术后4周 + 对乙酰氨基酚片 规格0.5g/片，每次0.25g，口服，每8小时1次，餐后服用，连续3天；【术后用药阶段】", "单腔永久心脏起搏器植入术", "心房颤动伴缓慢心室率起搏器术后管理方案", "已生成", "已确认"],
  [2, "U002", "乙*", "2026-08-02 11:00:00", "女", 42, "慢性胃炎", "130****0002", "江苏省无锡市", "稳定期", "青霉素过敏", "奥美拉唑肠溶胶囊+铝碳酸镁咀嚼片", "奥美拉唑肠溶胶囊 规格20mg/粒，每次20mg，口服，每日1次，早餐前服用，连续14天 + 铝碳酸镁咀嚼片 规格0.5g/片，每次1g，口服，每日3次，餐后1小时服用，连续14天", "", "慢性胃炎症状与用药随访方案", "已生成", "已确认"],
];

const records = [
  {
    userid: "U001",
    aiManagerIntro: "你好！我是您的AI健康管理师，将围绕心房颤动伴缓慢心室率及起搏器术后阶段，提供用药教育、症状观察、活动恢复和复诊提醒，协助您理解心房颤动伴缓慢心室率起搏器术后管理方案；具体调整由临床医生复核。",
    aiMedicalRecord: "就诊科室：心血管内科\n就诊日期：2026年8月1日\n主诉：源文件未提供\n体征：源文件未提供\n处置：源文件记录心房颤动伴缓慢心室率、单腔永久心脏起搏器植入术，以及华法林钠片和对乙酰氨基酚片处方；后续按审核后的全病程方案随访。",
    treatmentPlan: "• 单腔永久心脏起搏器植入术\n——【核心治疗·器械治疗】\n• 华法林钠片：华法林钠片 规格2.5mg/片，每次2.5mg，口服，每日1次，晚餐中服用，疗程至术后4周\n——【核心治疗·抗凝管理】\n• 对乙酰氨基酚片：对乙酰氨基酚片 规格0.5g/片，每次0.25g，口服，每8小时1次，餐后服用，连续3天；【术后用药阶段】\n——【辅助治疗·疼痛管理】",
    aiPharmacology: "华法林钠片属于维生素K拮抗剂，用于审核后方案中的抗凝管理，需按医嘱监测凝血指标并留意出血信号。对乙酰氨基酚片用于短期疼痛或发热管理，应核对所有复方制剂中的同成分总量并避免超量。单腔永久心脏起搏器植入术通过器械提供节律支持，设备参数和切口情况需按期复核。",
    aiHealthPlan: "① 用药阶段：按审核处方使用华法林钠片和对乙酰氨基酚片，不自行增减或停药，记录漏服及出血相关异常。\n② 术后恢复：保持切口清洁干燥，活动量循序增加，避免牵拉植入侧上肢，具体限制遵循手术团队意见。\n③ 随访管理：按计划完成切口、设备与抗凝复核；饮食保持规律，涉及维生素K摄入时维持相对稳定并咨询医生。",
    monitoringIndicators: "切口状态：每日观察红肿、渗液、裂开或异常疼痛\n脉搏与不适：每日记录，并在明显过快、过慢或伴头晕时联系医生\n出血信号：每日留意鼻出血、牙龈出血、血尿、黑便或大片瘀斑\n抗凝监测：按抗凝门诊安排复查凝血指标，目标范围以临床医生设定为准",
    lifestyleAvoid: "• 避免自行停用、加量或漏服华法林钠片\n• 避免碰撞性运动和可能造成外伤的剧烈活动\n• 避免按摩、挤压植入部位或在切口未愈合前浸水\n• 避免未经医生确认同时使用其他止痛药、保健品或活血类制品",
    lifestyleRecommend: "• 固定时间服药并使用记录表核对每日用药\n• 每日观察切口和皮肤瘀斑，发现变化及时拍照记录\n• 在医生允许范围内分次步行，逐步恢复日常活动\n• 饮食规律且维生素K来源食物摄入保持相对稳定，不突然大量改变",
    followupPlan: "• 术后近期：按手术团队安排复诊，评估切口愈合和起搏器工作状态\n• 抗凝用药期间：按抗凝门诊安排复查凝血指标并核对药物相互作用\n• 出现心悸、晕厥、出血或切口异常时提前就诊，不等待预约时间",
    emergencyReminder: "⚠ 出现晕厥、持续胸痛、明显呼吸困难或意识改变\n⚠ 出现呕血、黑便、血尿、无法止住的出血或迅速增大的瘀斑\n⚠ 切口裂开、大量渗液、明显红肿热痛或伴寒战\n⚠ 植入部位受到重击后出现明显疼痛、肿胀或设备相关异常感受\n⚠ 出现以上任一情况，请立即前往急诊或联系急救服务。",
  },
  {
    userid: "U002",
    aiManagerIntro: "你好！我是您的AI健康管理师，将围绕慢性胃炎稳定期的规范用药、症状观察、饮食调整和复诊规划提供支持，协助落实慢性胃炎症状与用药随访方案；建议由临床医生结合复诊情况调整。",
    aiMedicalRecord: "就诊科室：消化内科\n就诊日期：2026年8月2日\n主诉：源文件未提供\n体征：源文件未提供\n处置：源文件记录慢性胃炎、青霉素过敏，以及奥美拉唑肠溶胶囊和铝碳酸镁咀嚼片处方；后续按审核后的全病程方案管理。",
    treatmentPlan: "• 奥美拉唑肠溶胶囊：奥美拉唑肠溶胶囊 规格20mg/粒，每次20mg，口服，每日1次，早餐前服用，连续14天\n——【核心治疗·抑酸管理】\n• 铝碳酸镁咀嚼片：铝碳酸镁咀嚼片 规格0.5g/片，每次1g，口服，每日3次，餐后1小时服用，连续14天\n——【辅助治疗·胃黏膜症状管理】",
    aiPharmacology: "奥美拉唑肠溶胶囊属于质子泵抑制剂，可减少胃酸分泌，需按审核处方在规定时机服用，长期或反复使用应由医生评估。铝碳酸镁咀嚼片可中和胃酸并吸附胆汁酸，与其他口服药可能相互影响，服用间隔应依处方和医生指导。青霉素过敏信息应在每次就诊和购药时主动说明。",
    aiHealthPlan: "① 用药管理：按审核处方使用奥美拉唑肠溶胶囊和铝碳酸镁咀嚼片，核对服药时机，并与其他口服药保持医生建议的间隔。\n② 症状记录：记录上腹不适、反酸、恶心及进食关系；症状持续加重或出现危险信号时提前就医。\n③ 生活管理：饮食规律、少量分餐，识别并减少个人诱发食物，避免自行长期续用抑酸药。",
    monitoringIndicators: "上腹部不适：每日记录发生时间、持续时间及与进食关系\n反酸或烧灼感：每日记录频次，持续增加时联系医生\n进食与体重趋势：每周观察，出现不明原因持续下降时就诊\n药物耐受：用药期间观察皮疹、腹泻、便秘等变化并及时反馈",
    lifestyleAvoid: "• 避免空腹饮酒、吸烟及大量摄入刺激性饮品\n• 避免暴饮暴食、进食过快或睡前大量进食\n• 避免自行长期加量或延长奥美拉唑肠溶胶囊疗程\n• 避免忽视黑便、呕血、进行性吞咽困难等危险信号",
    lifestyleRecommend: "• 规律进餐并根据耐受情况采用少量分餐\n• 记录可能诱发反酸或上腹不适的食物并逐步调整\n• 饭后保持适度活动，避免立即平卧\n• 每次就诊主动告知青霉素过敏和当前全部用药",
    followupPlan: "• 完成审核处方疗程后复诊，评估症状变化和是否需要调整方案\n• 症状反复或影响进食时提前至消化内科复诊，由医生判断是否需要进一步检查\n• 出现出血、吞咽困难或持续呕吐时立即就诊，不等待预约时间",
    emergencyReminder: "⚠ 呕血、咖啡色呕吐物或黑便\n⚠ 持续或迅速加重的剧烈腹痛\n⚠ 反复呕吐、无法进食饮水或出现明显脱水表现\n⚠ 进行性吞咽困难、晕厥或意识状态改变\n⚠ 出现以上任一情况，请立即前往急诊或联系急救服务。",
  },
];

const sourceWorkbook = Workbook.create();
const sourceSheet = sourceWorkbook.worksheets.add("Sheet1");
sourceSheet.getRange("A1:Q3").values = [sourceHeaders, ...sourceRows];
await (await SpreadsheetFile.exportXlsx(sourceWorkbook)).save(sourcePath);
await fs.writeFile(recordsPath, JSON.stringify(records, null, 2), "utf8");

const nodePath = process.execPath;
const run = (script, args) => spawnSync(nodePath, [path.join(scriptDir, script), ...args], {
  encoding: "utf8",
  env: { ...process.env, CODEX_NODE_MODULES: nodeModules },
});

const extractResult = run("extract_health_plan_patients.mjs", ["--input", sourcePath, "--output", extractedPath]);
assert.equal(extractResult.status, 0, `${extractResult.stdout}\n${extractResult.stderr}`);
assert.deepEqual(JSON.parse(await fs.readFile(extractedPath, "utf8")), [
  { userid: "U001", activateTime: "2026-08-01 10:00:00", gender: "男", age: 70, disease: "心房颤动伴缓慢心室率", allergyHistory: "无", combinedMedication: ["华法林钠片", "对乙酰氨基酚片"], prescriptionList: sourceRows[0][12], surgeryName: "单腔永久心脏起搏器植入术", coursePlanName: "心房颤动伴缓慢心室率起搏器术后管理方案" },
  { userid: "U002", activateTime: "2026-08-02 11:00:00", gender: "女", age: 42, disease: "慢性胃炎", allergyHistory: "青霉素过敏", combinedMedication: ["奥美拉唑肠溶胶囊", "铝碳酸镁咀嚼片"], prescriptionList: sourceRows[1][12], surgeryName: "", coursePlanName: "慢性胃炎症状与用药随访方案" },
]);

const buildArgs = ["--input", sourcePath, "--records", recordsPath, "--template", templatePath, "--output", outputPath];
const result = run("build_health_plan_workbook.mjs", buildArgs);
assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);

const outputWorkbook = await SpreadsheetFile.importXlsx(await FileBlob.load(outputPath));
const outputSheet = outputWorkbook.worksheets.getItemAt(0);
const outputRows = outputSheet.getUsedRange(true).values;
const expectedHeaders = ["userid", "AI健康管理师介绍", "AI病历解读", "治疗方案梳理", "AI药理科普", "AI健康管理方案", "建议监测指标", "生活方式建议_必须避免", "生活方式建议_建议执行", "复诊计划", "紧急就医提醒", "AI状态", "审核状态"];
assert.deepEqual(outputRows[0], expectedHeaders);
assert.equal(outputRows.length, 3);
assert.deepEqual(outputRows.slice(1).map((row) => row[0]), ["U001", "U002"]);
assert(outputRows.slice(1).every((row) => row.slice(1, 11).every((value) => String(value).trim())));
assert(outputRows.slice(1).every((row) => row[11] === "已生成" && row[12] === "待审核"));
assert.equal(outputSheet.tables.items.length, 1);

async function assertInvalidRecords(invalidRecords, expectedMessage) {
  await fs.writeFile(recordsPath, JSON.stringify(invalidRecords, null, 2), "utf8");
  const invalidResult = run("build_health_plan_workbook.mjs", buildArgs);
  assert.notEqual(invalidResult.status, 0);
  assert.match(`${invalidResult.stdout}\n${invalidResult.stderr}`, expectedMessage);
}

await assertInvalidRecords([records[0]], /生成记录数量与患者数量不一致/);
await assertInvalidRecords([...records, { ...records[1], userid: "U003" }], /生成记录数量与患者数量不一致/);
await assertInvalidRecords([{ ...records[0], userid: "CHANGED" }, records[1]], /缺少userid记录|userid被改变/);
await assertInvalidRecords([{ ...records[0], lifestyleAvoid: "不要剧烈活动" }, records[1]], /必须包含至少4个•分项/);
await assertInvalidRecords([{ ...records[0], aiMedicalRecord: records[0].aiMedicalRecord.replace("体征：源文件未提供", "体征：体温36.5℃，血压120\/80mmHg") }, records[1]], /不得虚构主诉、体征或生命体征数值/);
await assertInvalidRecords([{ ...records[0], treatmentPlan: `${records[0].treatmentPlan}\n• 阿莫西林胶囊\n——【辅助治疗·抗感染】` }, records[1]], /治疗方案项目数量|输入之外/);
await assertInvalidRecords([{ ...records[0], aiPharmacology: records[0].aiPharmacology.replace("华法林钠片", "该抗凝药") }, records[1]], /药理科普遗漏联合用药/);

console.log(JSON.stringify({ status: "passed", rows: outputRows.length, columns: outputRows[0].length }));
