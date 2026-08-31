const unsupportedBasisPattern = /(?:按|依据|根据|依照|遵循)(?:已|经)?(?:审核|审定|确认)|(?:已|经)(?:审核|审定|确认)|(?:审核|审定)(?:处方|方案|疗程|用药)/;
const stagedCyclePattern = /阶段/;

export function validateMedicationTrackingWording({ userid, medicationPlan, medicationCycle, medicationItems }) {
  const generatedText = [medicationPlan, medicationCycle, JSON.stringify(medicationItems ?? [])].join("\n");
  if (unsupportedBasisPattern.test(generatedText)) {
    throw new Error(`${userid}的用药方案、用药周期和用药明细不得引用已审核、已审定或已确认的处方或方案，应直接陈述用药安排`);
  }
  if (stagedCyclePattern.test(String(medicationCycle ?? ""))) {
    throw new Error(`${userid}的medicationCycle不得使用阶段化表述，应写成连续用药周期`);
  }
}
