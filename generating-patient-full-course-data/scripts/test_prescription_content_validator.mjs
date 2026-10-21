import assert from "node:assert/strict";
import { validatePrescriptionContent } from "./prescription_content_validator.mjs";

const prescription = "牛黄清火丸 规格3g/丸；每次用量2丸；口服，一日2次，早、晚餐后温水送服；疗程3天";
for (const warning of [
  "孕妇禁用", "本品含雄黄，不宜久服", "避免与其他含雄黄、朱砂或砷的中成药同服",
  "服药3天症状无缓解或加重应停药就医", "观察皮疹和出血", "需监测肝功能",
  "因青霉素过敏，改用本药", "需根据肌酐清除率调整", "药理机制为抑制炎症",
]) {
  assert.throws(() => validatePrescriptionContent({
    userid: "TEST", medication: "牛黄清火丸", prescriptionEntry: `${prescription}；${warning}`,
  }), /处方清单只允许药品名称、规格、用法用量、服用方式、频次及疗程/);
}
for (const entry of [
  prescription,
  `${prescription}，疼痛缓解即停`,
  `${prescription}，3天后停药`,
  "外用药 规格1%/支；每次1g；外用于患处，每日2次；疗程3天后停用",
  "奥美拉唑肠溶胶囊 规格20mg/粒；每次20mg；口服，每日1次，早餐前整粒吞服，不得咀嚼；连续7天",
  "氟康唑胶囊 规格150mg/粒，每次150mg，口服，单次服用，餐后服用",
]) {
  assert.doesNotThrow(() => validatePrescriptionContent({ userid: "TEST", medication: "测试药品", prescriptionEntry: entry }));
}
console.log(JSON.stringify({ status: "passed", suite: "prescription content" }));
