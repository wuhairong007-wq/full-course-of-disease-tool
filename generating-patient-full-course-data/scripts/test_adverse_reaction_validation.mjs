import assert from "node:assert/strict";
import { validateAdverseReactionRecord } from "./adverse_reaction_validation.mjs";

const patient = {
  userid: "U001",
  diseaseName: "心房颤动",
  adverseReactionLevel: "高度",
  allergyHistory: "青霉素过敏",
  combinedMedication: "利伐沙班片+对乙酰氨基酚片",
  prescriptionList: "利伐沙班片 规格10mg/片，每次10mg，口服，每日1次，晚餐中服用，长期 + 对乙酰氨基酚片 规格0.5g/片，每次0.5g，口服，每日2次，餐后服用，连续3天",
};
const valid = {
  userid: "U001",
  symptomDescription: "出现心悸、胸闷加重并伴短暂头晕。",
  treatmentMeasures: "立即停止活动并联系心血管专科，由医生复核现有用药并评估是否需要急诊处置。",
  outcome: "经初步处理后不适有所减轻，仍需继续观察并复诊评估。",
  remarks: "既往青霉素过敏；如出现晕厥、持续胸痛、明显呼吸困难或异常出血，应立即就医。",
};

assert.doesNotThrow(() => validateAdverseReactionRecord(valid, patient));
assert.throws(() => validateAdverseReactionRecord({ ...valid, treatmentMeasures: "给予阿司匹林肠溶片并继续观察。" }, patient), /不得引入处方清单之外的药物/);
assert.throws(() => validateAdverseReactionRecord({ ...valid, outcome: "患者已完全恢复，相关指标恢复正常。" }, patient), /不得承诺完全恢复或虚构指标正常/);
assert.throws(() => validateAdverseReactionRecord({ ...valid, treatmentMeasures: "立即收入院并完成心脏超声检查。" }, patient), /不得虚构住院或已完成的检查处置/);
assert.throws(() => validateAdverseReactionRecord({ ...valid, remarks: "如有不适请及时复诊。" }, patient), /必须提示既往过敏史/);
assert.throws(() => validateAdverseReactionRecord({ ...valid, treatmentMeasures: "在家休息并继续观察。" }, patient), /高度患者的处理措施必须体现紧急评估或专科干预/);
assert.throws(() => validateAdverseReactionRecord({ ...valid, symptomDescription: "确诊为急性心肌梗死。" }, patient), /不得新增或确认源文件未提供的诊断/);

console.log(JSON.stringify({ status: "passed", validations: 7 }));
