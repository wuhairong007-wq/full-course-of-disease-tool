import assert from "node:assert/strict";
import { validateHealthPlanContent, validateMedicalRecordContent, validatePharmacologyContent, validatePharmacologyParagraph } from "./health_plan_content_validator.mjs";

const patient = {
  userid: "U001",
  disease: "慢性胃炎",
  combinedMedication: ["奥美拉唑肠溶胶囊"],
  surgeryName: "",
  prescriptionList: "奥美拉唑肠溶胶囊 规格20mg/粒，每次20mg，口服，每日1次，早餐前服用，连续14天",
};
const validParagraph = "奥美拉唑肠溶胶囊：药理机制通过抑制胃壁细胞质子泵减少胃酸分泌；阻断胃酸分泌的终末环节，降低胃内酸度，减轻胃酸对胃黏膜的刺激。";

assert.doesNotThrow(() => validatePharmacologyParagraph(validParagraph, patient, "奥美拉唑肠溶胶囊"));
assert.doesNotThrow(() => validatePharmacologyParagraph("奥美拉唑肠溶胶囊：抑制胃壁细胞质子泵，减少胃酸分泌。", patient, "奥美拉唑肠溶胶囊"));
for (const instruction of [
  "规格20mg/粒", "每次20mg", "口服", "每日1次", "一日两次", "每天早晚各一次",
  "每8小时1次", "qd", "早餐前服用", "连续14天", "疗程2周",
  "整粒吞服，不可嚼碎", "温水送服", "薄涂患处", "静脉滴注", "遵医嘱使用",
  "执行要点为定时用药", "主要风险与监测包括观察皮疹",
]) {
  assert.throws(
    () => validatePharmacologyParagraph(`${validParagraph}${instruction}。`, patient, "奥美拉唑肠溶胶囊"),
    /仅描述药理内容/,
    instruction,
  );
}
assert.doesNotThrow(() => validateMedicalRecordContent("就诊科室：消化内科\n就诊日期：2026年8月1日\n处置：围绕慢性胃炎开展管理。", "U001"));
assert.throws(
  () => validateMedicalRecordContent("就诊科室：消化内科\n全病程方案：慢性胃炎管理方案", "U001"),
  /不得出现全病程方案/,
);
assert.throws(
  () => validatePharmacologyParagraph(`${validParagraph}；`, patient, "奥美拉唑肠溶胶囊"),
  /多余的分号|多余分号/,
);
assert.throws(
  () => validatePharmacologyParagraph(validParagraph.replace("：药理机制", "：；药理机制"), patient, "奥美拉唑肠溶胶囊"),
  /多余的分号|多余分号/,
);
assert.throws(
  () => validatePharmacologyParagraph(validParagraph.replace("分泌；阻断", "分泌。；阻断"), patient, "奥美拉唑肠溶胶囊"),
  /多余的分号|多余分号/,
);
assert.throws(
  () => validatePharmacologyParagraph("奥美拉唑肠溶胶囊：属于常见药物，对相关疾病具有一定作用，相关内容需要进一步了解。", patient, "奥美拉唑肠溶胶囊"),
  /缺少通俗药理机制/,
);
assert.throws(
  () => validatePharmacologyParagraph(`${validParagraph}按审核处方执行。`, patient, "奥美拉唑肠溶胶囊"),
  /不得使用按审核处方|处方信息不足/,
);
assert.throws(
  () => validateHealthPlanContent({ aiMedicalRecord: "按已确认方案执行。" }),
  /不得引用审核处方、审核方案或已确认方案/,
);
assert.throws(
  () => validatePharmacologyContent(`${validParagraph}\n保持清淡饮食并规律运动。`, patient),
  /只能介绍患者的每种药品/,
);
assert.throws(
  () => validatePharmacologyContent(`${validParagraph}\n手术：通过器械提供支持。`, { ...patient, surgeryName: "手术" }),
  /只能介绍患者的每种药品/,
);
assert.throws(() => validatePharmacologyContent(`${validParagraph}\n${validParagraph}`, patient), /必须且只能为每种药品生成一段/);

for (const phrase of ["辅助对症", "辅助性对症", "非患者已报告症状", "非已观察结果", "并非患者已报告的症状", "并非已观察到的结果", "拟采集提示", "模拟检查提示"]) {
  for (const field of ["aiManagerIntro", "aiMedicalRecord", "treatmentPlan", "aiPharmacology", "aiHealthPlan", "monitoringIndicators", "lifestyleAvoid", "lifestyleRecommend", "followupPlan", "emergencyReminder"]) {
    assert.throws(
      () => validateHealthPlanContent({ userid: "U001", [field]: phrase }),
      /不得出现辅助对症或事实状态说明文案/,
    );
  }
}
assert.doesNotThrow(() => validateHealthPlanContent({
  userid: "U001",
  aiMedicalRecord: "主诉：门诊拟询问上腹不适与进食影响\n体征：门诊拟检查腹部情况及营养状态",
  aiHealthPlan: "每日观察有无皮疹，出现异常及时就医。",
}));

console.log(JSON.stringify({ status: "passed", suite: "health-plan-content-validator" }));
