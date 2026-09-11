import { selectEquivalentCandidate } from "./equivalent_medication_selector.mjs";

const requiredRoles = ["产品", "病因/一线治疗", "维持治疗", "围手术期治疗", "症状支持"];
const normalize = value => String(value ?? "").trim();
const hasText = value => typeof value === "string" && value.trim().length > 0;

function validateReview(review, record, patient) {
  const userid = normalize(patient.userid);
  const fail = message => { throw new Error(`${userid}的用药评估：${message}`); };
  if (!review || review.userid !== userid || record?.userid !== userid) fail("userid或顺序与原表不一致");
  if (!Array.isArray(review.roles) || review.roles.length !== requiredRoles.length ||
      new Set(review.roles.map(role => role?.role)).size !== requiredRoles.length ||
      review.roles.some(role => !requiredRoles.includes(role?.role))) fail("必须覆盖五类治疗用途且不重复");
  const names = new Set();
  const selected = [];
  for (const role of review.roles) {
    if (!Array.isArray(role.evidence) || !role.evidence.length) fail(`${role.role}缺少原表依据`);
    for (const fact of role.evidence) {
      if (!fact || !hasText(fact.field) || !Object.hasOwn(patient, fact.field) ||
          !normalize(patient[fact.field]) || normalize(fact.value) !== normalize(patient[fact.field])) {
        fail(`${role.role}引用的原表事实不一致：${fact?.field ?? "空字段"}`);
      }
    }
    if (!hasText(role.rationale)) fail(`${role.role}缺少临床依据与推理`);
    if (!Array.isArray(role.candidates)) fail(`${role.role}候选必须为数组`);
    if (!role.candidates.some(candidate => candidate?.selected === true) && !hasText(role.exclusionReason)) {
      fail(`${role.role}缺少排除理由`);
    }
    const groups = new Map();
    for (const candidate of role.candidates) {
      if (!candidate || !hasText(candidate.medication)) fail("候选药名不能为空");
      const name = candidate.medication;
      if (name !== name.trim() || names.has(name.trim())) fail(`重复候选或药名含多余空白：${name}`);
      names.add(name);
      if (!hasText(candidate.indication)) fail(`${name}缺少适应证`);
      if (!hasText(candidate.safetyAssessment)) fail(`${name}缺少安全评估`);
      if (typeof candidate.eligible !== "boolean" || typeof candidate.selected !== "boolean") fail(`${name}选择状态必须为布尔值`);
      if (candidate.selected && !candidate.eligible) fail(`${name}不可选却被选中`);
      if (!candidate.selected && !hasText(candidate.exclusionReason)) fail(`${name}缺少排除理由`);
      if (candidate.selected && normalize(candidate.exclusionReason)) fail(`${name}选中与排除理由矛盾`);
      if (candidate.equivalenceGroup !== undefined && typeof candidate.equivalenceGroup !== "string") fail(`${name}等效组必须为字符串`);
      const groupName = normalize(candidate.equivalenceGroup);
      if (candidate.eligible) {
        if (groupName) {
          if (!groups.has(groupName)) groups.set(groupName, []);
          groups.get(groupName).push(candidate);
        } else if (!candidate.selected) {
          fail(`${name}已判定可选但被遗漏；不适用时须明确排除`);
        }
      }
      if (candidate.selected) selected.push(name);
    }
    for (const [groupName, candidates] of groups) {
      const choices = candidates.filter(candidate => candidate.selected);
      if (choices.length !== 1) fail(`${role.role}:${groupName}等效组必须且只能选一个`);
      const expected = selectEquivalentCandidate({
        userid, disease: normalize(patient["疾病"]), therapyRole: `${role.role}:${groupName}`,
        candidates: candidates.map(candidate => ({ name: candidate.medication })),
      });
      if (choices[0].medication !== expected.name) fail(`${groupName}不符合等效候选稳定选择结果`);
    }
  }
  if (!Array.isArray(record.combinedMedication) || selected.length !== record.combinedMedication.length ||
      new Set(record.combinedMedication).size !== selected.length ||
      selected.some(name => !record.combinedMedication.includes(name))) fail("评估选中药物与最终用药不一致");
}

export function validateMedicationReviews({ reviews, records, patients }) {
  if (!Array.isArray(reviews) || !Array.isArray(records) || !Array.isArray(patients) ||
      reviews.length !== patients.length || records.length !== patients.length) {
    throw new Error("用药评估必须完整覆盖全部患者");
  }
  const userids = patients.map(patient => normalize(patient?.userid));
  if (userids.some(userid => !userid) || new Set(userids).size !== userids.length) throw new Error("用药评估存在空或重复userid");
  patients.forEach((patient, index) => validateReview(reviews[index], records[index], patient));
}
