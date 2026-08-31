const externalBasisPattern = /按(?:已?审核|审核|审定|已确认)(?:处方|方案)|依据(?:经审定|已审核|审核|已确认)(?:处方|方案)|根据(?:已确认|审核|审定)(?:处方|方案)|已审核(?:治疗|用药|疗程|方案)|审核后的(?:抗凝管理|用药|治疗|方案)/;
const mechanismPattern = /机制|通过|抑制|阻断|拮抗|激动|促进|调节|补充|替代|中和|结合|减少|增加|稳定|松弛|抗菌|抗炎|镇痛|保护|吸收|分泌|代谢|酶|受体/;
const executionPattern = /规格|每次|每日|每周|每\d+小时|口服|外用|涂抹|注射|吸入|疗程|连续\d+[天日周]|长期|早餐前|早餐后|午餐前|午餐后|晚餐前|晚餐后|餐前|餐后|睡前|间隔/;
const safetyPattern = /注意|避免|监测|观察|风险|不良反应|咨询|就医|复核|过敏|停用|禁用/;

const normalize = (value) => String(value ?? "").trim();

function prescriptionSegment(patient, medication) {
  const source = normalize(patient.prescriptionList);
  const start = source.indexOf(medication);
  if (start < 0) return "";
  const rest = source.slice(start + medication.length);
  const nextMedication = patient.combinedMedication
    .filter((candidate) => candidate !== medication)
    .map((candidate) => rest.indexOf(candidate))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  return rest.slice(0, nextMedication === undefined ? rest.length : nextMedication);
}

function reviewedExecutionTokens(segment) {
  return [
    segment.match(/规格\s*[：:]?\s*[^，；+\s]+/)?.[0],
    segment.match(/每次\s*[^，；+]+/)?.[0],
    segment.match(/(?:每日|一日)\d+(?:[-～至]\d+)?次|每\d+小时1次|每周\d+次|隔日1次/)?.[0],
    segment.match(/(?:早餐前|早餐后|午餐前|午餐后|晚餐前|晚餐后|餐前|餐中|餐后|睡前)/)?.[0],
    segment.match(/(?:连续|疗程(?:为|共)?|使用)\d+(?:天|日|周)|长期|无限期/)?.[0],
  ].filter(Boolean).map((token) => token.replace(/\s+/g, "").replace(/[，；。]+$/, ""));
}

export function validatePharmacologyParagraph(text, patient, medication) {
  const value = normalize(text);
  if (externalBasisPattern.test(value)) {
    throw new Error(`${patient.userid}的${medication}药理科普不得使用按审核处方或类似外部依据文案`);
  }
  if (!value.startsWith(medication)) throw new Error(`${patient.userid}的AI药理科普必须为${medication}单独分段并以药名开头`);
  if (value.length < medication.length + 45) throw new Error(`${patient.userid}的${medication}药理科普过于简略，必须说明机制、用途、执行要点和风险监测`);
  if (!mechanismPattern.test(value)) throw new Error(`${patient.userid}的${medication}药理科普缺少通俗药理机制`);
  const patientContext = [patient.disease, patient.surgeryName].map(normalize).filter(Boolean);
  if (!patientContext.some((context) => value.includes(context))) {
    throw new Error(`${patient.userid}的${medication}药理科普本方案用途必须关联患者疾病或已审核手术`);
  }
  const segment = prescriptionSegment(patient, medication);
  const executionTokens = reviewedExecutionTokens(segment);
  const compactValue = value.replace(/\s+/g, "");
  const hasExecutionToken = executionTokens.some((token) => compactValue.includes(token))
    || executionTokens.some((token) => token.startsWith("规格") && compactValue.includes(token.slice(2)));
  if (!hasExecutionToken) {
    throw new Error(`${patient.userid}的${medication}药理科普执行要点必须对应该药处方信息`);
  }
  if (!executionPattern.test(value)) throw new Error(`${patient.userid}的${medication}药理科普缺少用法或疗程执行要点`);
  if (!safetyPattern.test(value)) throw new Error(`${patient.userid}的${medication}药理科普缺少风险或监测提示`);
}

export function validateHealthPlanContent(fields) {
  const values = [];
  const visit = (value) => {
    if (typeof value === "string") values.push(value);
    else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === "object") Object.values(value).forEach(visit);
  };
  visit(fields);
  if (values.some((value) => externalBasisPattern.test(value))) {
    throw new Error(`${fields.userid || "患者"}的健康管理方案不得引用审核处方、审核方案或已确认方案，请直接写明药品、用法和处理动作`);
  }
}

export function validatePharmacologyContent(text, patient) {
  const lines = normalize(text).split(/\r?\n/).map(normalize).filter(Boolean);
  for (const line of lines) {
    if (!patient.combinedMedication.some((medication) => line.startsWith(medication))
      && !(patient.surgeryName && line.startsWith(patient.surgeryName))) {
      throw new Error(`${patient.userid}的AI药理科普只能介绍患者的每种药品及已有手术或器械`);
    }
  }
}
