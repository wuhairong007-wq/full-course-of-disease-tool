import assert from "node:assert/strict";
import { validateMedicationTrackingWording } from "./medication_tracking_wording_validator.mjs";

const valid = {
  userid: "U001",
  medicationPlan: "针对心房颤动使用利伐沙班片，固定时间服用并观察异常出血。",
  medicationCycle: "自2026-08-01起，利伐沙班片长期使用，对乙酰氨基酚片连续3天。",
  medicationItems: [{ precautions: "新增药物前由医生或药师复核相互作用。" }],
};

assert.doesNotThrow(() => validateMedicationTrackingWording(valid));

for (const medicationPlan of [
  "按已审核处方执行。",
  "按审核方案长期用药。",
  "依据经审定方案服药。",
  "根据已确认处方用药。",
]) {
  assert.throws(
    () => validateMedicationTrackingWording({ ...valid, medicationPlan }),
    /不得引用已审核、已审定或已确认的处方或方案/,
  );
}

for (const medicationCycle of ["第1阶段：连续用药3天。", "第2阶段继续治疗。", "第一阶段用药，第二阶段复评。"]) {
  assert.throws(
    () => validateMedicationTrackingWording({ ...valid, medicationCycle }),
    /不得使用阶段化表述/,
  );
}

console.log(JSON.stringify({ status: "passed", unsupportedBasisCases: 4, stagedCycleCases: 3 }));
