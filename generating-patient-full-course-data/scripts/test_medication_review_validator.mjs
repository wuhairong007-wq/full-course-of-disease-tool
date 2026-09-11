import assert from "node:assert/strict";
import { validateMedicationReviews } from "./medication_review_validator.mjs";
import { selectEquivalentCandidate } from "./equivalent_medication_selector.mjs";

const roles = ["产品", "病因/一线治疗", "维持治疗", "围手术期治疗", "症状支持"];
const patient = { userid: "U001", 疾病: "测试诊断", 疼痛评分: 0, 炎症表现: "无红肿" };
const candidate = (medication, overrides = {}) => ({
  medication, indication: "测试用药用途", safetyAssessment: "测试中已完成年龄、过敏、禁忌及重复治疗检查",
  eligible: true, selected: true, exclusionReason: "", equivalenceGroup: "", ...overrides,
});
const review = {
  userid: patient.userid,
  roles: roles.map(role => ({
    role, evidence: [{ field: "疾病", value: "测试诊断" }],
    rationale: "合成测试依据，仅验证数据契约", candidates: [], exclusionReason: "测试场景不适用",
  })),
};
review.roles[0].candidates = [candidate("测试药甲")];
review.roles[0].exclusionReason = "";
const record = { userid: "U001", combinedMedication: ["测试药甲"] };
const validate = (changed = review, output = record, patients = [patient]) => validateMedicationReviews({
  reviews: [changed], records: [output], patients,
});
assert.doesNotThrow(() => validate());
function invalid(change, message) {
  const changed = structuredClone(review);
  change(changed);
  assert.throws(() => validate(changed), message);
}
invalid(value => { value.userid = "U002"; }, /userid|顺序/);
invalid(value => { value.roles.pop(); }, /五类/);
invalid(value => { value.roles[1].role = "产品"; }, /五类/);
invalid(value => { value.roles[0].evidence[0].value = "虚构诊断"; }, /原表事实/);
invalid(value => { value.roles[0].evidence = [{ field: "症状", value: "疼痛" }]; }, /原表事实/);
invalid(value => { value.roles[0].evidence = []; }, /原表依据/);
invalid(value => { value.roles[0].rationale = ""; }, /临床依据/);
invalid(value => { value.roles[0].candidates[0].safetyAssessment = ""; }, /安全评估/);
invalid(value => { value.roles[0].candidates[0].indication = ""; }, /适应证/);
invalid(value => { value.roles[0].candidates[0].eligible = false; }, /不可选/);
invalid(value => { value.roles[0].candidates[0].eligible = "true"; }, /布尔/);
invalid(value => { value.roles[0].candidates[0].selected = false; }, /排除理由|遗漏/);
invalid(value => { value.roles[0].candidates.push(candidate("测试药乙", { eligible: false, selected: false })); }, /排除理由/);
invalid(value => { value.roles[1].exclusionReason = ""; }, /排除理由/);
invalid(value => { value.roles[0].candidates.push(candidate("测试药甲")); }, /重复候选/);
assert.throws(() => validate(review, { ...record, combinedMedication: ["测试药甲", "凑数药"] }), /最终用药/);
assert.throws(() => validate(review, { ...record, combinedMedication: [] }), /最终用药/);
assert.throws(() => validateMedicationReviews({ reviews: [], records: [record], patients: [patient] }), /覆盖/);
assert.throws(() => validateMedicationReviews({ reviews: [review, review], records: [record, record], patients: [patient, patient] }), /重复userid/);
const zero = structuredClone(review);
zero.roles[0].evidence.push({ field: "疼痛评分", value: "0" }, { field: "炎症表现", value: "无红肿" });
assert.doesNotThrow(() => validate(zero));
const equivalents = structuredClone(review);
const options = [candidate("测试药乙"), candidate("测试药丙")];
const selected = selectEquivalentCandidate({ userid: "U001", disease: "测试诊断", therapyRole: "症状支持:局部镇痛", candidates: options.map(option => ({ name: option.medication })) });
equivalents.roles[4].candidates = options.map(option => ({
  ...option, equivalenceGroup: "局部镇痛", selected: option.medication === selected.name,
  exclusionReason: option.medication === selected.name ? "" : "同组等效择一",
}));
equivalents.roles[4].exclusionReason = "";
const dual = { ...record, combinedMedication: ["测试药甲", selected.name] };
assert.doesNotThrow(() => validate(equivalents, dual));
const filtered = structuredClone(equivalents);
filtered.roles[4].candidates.push(candidate("禁忌测试药", {
  eligible: false, selected: false, exclusionReason: "测试过敏限制", equivalenceGroup: "局部镇痛",
}));
assert.doesNotThrow(() => validate(filtered, dual));
const unselectedGroup = structuredClone(equivalents);
unselectedGroup.roles[4].candidates.forEach(option => {
  option.eligible = false; option.selected = false; option.exclusionReason = "全部候选不适用";
});
unselectedGroup.roles[4].exclusionReason = "全部候选不适用";
assert.doesNotThrow(() => validate(unselectedGroup));
const omitted = structuredClone(review);
omitted.roles[2].candidates = [candidate("测试药丁", { selected: false, exclusionReason: "只想保留单药" })];
assert.throws(() => validate(omitted), /遗漏/);
const wrong = structuredClone(equivalents);
wrong.roles[4].candidates.forEach(option => { option.selected = !option.selected; option.exclusionReason = option.selected ? "" : "同组择一"; });
assert.throws(() => validate(wrong, { ...record, combinedMedication: ["测试药甲", wrong.roles[4].candidates.find(option => option.selected).medication] }), /稳定选择/);
wrong.roles[4].candidates.forEach(option => { option.selected = true; option.exclusionReason = ""; });
assert.throws(() => validate(wrong), /等效组/);
const triple = structuredClone(equivalents);
triple.roles[2].candidates = [candidate("测试药丁")];
triple.roles[2].exclusionReason = "";
assert.doesNotThrow(() => validate(triple, { ...record, combinedMedication: ["测试药甲", "测试药丁", selected.name] }));
console.log(JSON.stringify({ status: "passed", suite: "medication review" }));
