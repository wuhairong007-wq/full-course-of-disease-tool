import assert from "node:assert/strict";
import { validateHealthPlanContent, validatePharmacologyContent, validatePharmacologyParagraph } from "./health_plan_content_validator.mjs";

const patient = {
  userid: "U001",
  disease: "慢性胃炎",
  combinedMedication: ["奥美拉唑肠溶胶囊"],
  surgeryName: "",
  prescriptionList: "奥美拉唑肠溶胶囊 规格20mg/粒，每次20mg，口服，每日1次，早餐前服用，连续14天",
};
const validParagraph = "奥美拉唑肠溶胶囊：药理机制通过抑制胃壁细胞质子泵减少胃酸分泌；本方案用途用于慢性胃炎的抑酸管理；执行要点为规格20mg/粒，每次20mg，口服，每日1次，早餐前服用，连续14天；主要风险与监测包括观察腹泻、皮疹等不良反应，异常时咨询医生。";

assert.doesNotThrow(() => validatePharmacologyParagraph(validParagraph, patient, "奥美拉唑肠溶胶囊"));
assert.throws(
  () => validatePharmacologyParagraph(validParagraph.replace("用于慢性胃炎的抑酸管理", "用于心脏节律管理"), patient, "奥美拉唑肠溶胶囊"),
  /本方案用途必须关联患者疾病或已审核手术/,
);
assert.throws(
  () => validatePharmacologyParagraph(validParagraph.replace("执行要点为规格20mg/粒，每次20mg，口服，每日1次，早餐前服用，连续14天", "执行要点为按审核处方执行"), patient, "奥美拉唑肠溶胶囊"),
  /不得使用按审核处方|处方信息不足/,
);
assert.throws(
  () => validateHealthPlanContent({ aiMedicalRecord: "按已确认方案执行。" }),
  /不得引用审核处方、审核方案或已确认方案/,
);
assert.throws(
  () => validatePharmacologyContent(`${validParagraph}\n保持清淡饮食并规律运动。`, patient),
  /只能介绍患者的每种药品及已有手术或器械/,
);

console.log(JSON.stringify({ status: "passed", cases: 5 }));
