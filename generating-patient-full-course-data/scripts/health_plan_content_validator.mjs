const externalBasisPattern = /按(?:已?审核|审核|审定|已确认)(?:处方|方案)|依据(?:经审定|已审核|审核|已确认)(?:处方|方案)|根据(?:已确认|审核|审定)(?:处方|方案)|已审核(?:治疗|用药|疗程|方案)|审核后的(?:抗凝管理|用药|治疗|方案)/;
const mechanismPattern = /机制|通过|抑制|阻断|拮抗|激动|促进|调节|补充|替代|中和|结合|减少|增加|稳定|松弛|抗菌|抗炎|镇痛|保护|吸收|分泌|代谢|酶|受体/;
const executionPattern = /规格|每次|每日|每周|每\d+小时|口服|外用|涂抹|注射|吸入|疗程|连续\d+[天日周]|长期|早餐前|早餐后|午餐前|午餐后|晚餐前|晚餐后|餐前|餐后|睡前|间隔/;
const safetyPattern = /注意|避免|监测|观察|风险|不良反应|咨询|就医|复核|过敏|停用|禁用/;
const redundantSemicolonPattern = /(?:^|[\r\n。！？：:])\s*；|；\s*(?:$|[\r\n。！？；])/;
const medicalRecordCoursePlanPattern = /全病程方案\s*[：:]\s*\S+/;
const metaCommentaryPattern = /辅助(?:性)?对症|(?:并非|非|不是)(?:患者)?(?:已)?(?:报告|观察)(?:到)?的?(?:症状|结果|体征|事实)|(?:模拟|拟)(?:采集|检查|询问)提示/;

const normalize = (value) => String(value ?? "").trim();

export function validateNoRedundantSemicolon(text, userid, fieldLabel) {
  const value = normalize(text);
  if (redundantSemicolonPattern.test(value)) {
    throw new Error(`${userid || "患者"}的${fieldLabel}含多余分号，不得在句号、冒号后或文案末尾追加“；”`);
  }
}

export function validateMedicalRecordContent(text, userid, { patient, mode = "real" } = {}) {
  const value = normalize(text);
  if (medicalRecordCoursePlanPattern.test(value)) {
    throw new Error(`${userid || "患者"}的门诊病历摘要不得出现全病程方案：xxxxx文案`);
  }
  if (!patient) return;
  if (!["real", "fictional-test"].includes(mode)) throw new Error(`不支持的门诊病历摘要模式：${mode}`);
  validateHealthPlanContent({ userid, aiMedicalRecord: value });
  const labels = ["就诊科室", "就诊日期", "主诉", "体征", "处置", "复诊"];
  const lines = value.split(/\r?\n/).map(normalize).filter(Boolean);
  const sections = {};
  for (const label of labels) {
    const matches = lines.filter((line) => line.startsWith(`${label}：`));
    if (!matches.length || !normalize(matches[0].slice(label.length + 1))) {
      throw new Error(`${userid}的门诊病历摘要缺少：${label}`);
    }
    if (matches.length !== 1) throw new Error(`${userid}的门诊病历摘要不得重复${label}，必须使用六段式结构`);
    sections[label] = normalize(matches[0].slice(label.length + 1));
  }
  if (lines.length !== labels.length || lines.some((line, index) => !line.startsWith(`${labels[index]}：`))) {
    throw new Error(`${userid}的门诊病历摘要必须按就诊科室、就诊日期、主诉、体征、处置、复诊排列为六段`);
  }
  if (mode === "real") {
    if (!/^门诊拟询问\S+/.test(sections.主诉)) {
      throw new Error(`${userid}的门诊病历摘要主诉必须明确为拟询问提示，不得写成已报告症状`);
    }
    if (!/^门诊拟检查\S+/.test(sections.体征)) {
      throw new Error(`${userid}的门诊病历摘要体征必须明确为拟检查提示，不得写成已观察结果`);
    }
    if (/(?:体温|血压|脉搏|心率|呼吸|血氧|\bT|\bP|\bBP)[^。\n]*\d|体征：[^\n]*(?:检查结果|影像|实验室|压痛阳性|肿胀明显)/.test(value)) {
      throw new Error(`${userid}的门诊病历摘要不得伪造体征或检查结果`);
    }
    return;
  }
  if (/模拟|虚构|拟询问|拟采集|待采集|待询问/.test(sections.主诉)) {
    throw new Error(`${userid}的门诊病历摘要主诉必须描述典型就诊信息，不得写成采集提示或模拟说明`);
  }
  if (!/[0-9一二三四五六七八九十百两半]+(?:余)?(?:分钟|小时|天|日|周|个月|月|年)/.test(sections.主诉)) {
    throw new Error(`${userid}的门诊病历摘要主诉必须包含病程或持续时间`);
  }
  const findingPattern = /(?:体温|\bT)\s*[：:]?\s*\d+(?:\.\d+)?\s*(?:℃|°C)|(?:血压|\bBP)\s*[：:]?\s*\d+\s*[/／]\s*\d+|(?:心率|脉搏|\bP)\s*[：:]?\s*\d+\s*次|压痛|肿胀|红肿|活动受限|腹软|切口干燥/;
  if (/模拟|虚构|拟检查|拟采集|待检查/.test(sections.体征) || !findingPattern.test(sections.体征)) {
    throw new Error(`${userid}的门诊病历摘要体征必须描述具体查体信息，不得写成检查提示或模拟说明`);
  }
  const disease = normalize(patient.disease);
  const coursePlanName = normalize(patient.coursePlanName);
  if (!disease || !coursePlanName.includes(disease)) {
    throw new Error(`${userid}的疾病与全病程方案名称不一致，请核对疾病及方案`);
  }
  if (!sections.处置.includes(disease)) {
    throw new Error(`${userid}的门诊病历摘要处置必须关联疾病名称，并与全病程方案阶段一致`);
  }
  const bloodPressures = [...sections.体征.matchAll(/(?:血压|\bBP)\s*[：:]?\s*(\d{2,3})\s*[/／]\s*(\d{2,3})\s*(?:mmHg|毫米汞柱)/gi)];
  if (bloodPressures.some((match) => Number(match[1]) <= Number(match[2]))) {
    throw new Error(`${userid}的门诊病历摘要血压收缩压与舒张压矛盾`);
  }
  if (/高血压/.test(disease)
    && (!bloodPressures.length || bloodPressures.some((match) => Number(match[1]) < 140 && Number(match[2]) < 90)
      || /血压正常/.test(sections.体征))) {
    throw new Error(`${userid}的高血压典型模拟就诊必须包含一致的升高血压读数，不得套用正常血压`);
  }
  if (/术后/.test(coursePlanName)) {
    const unoperated = /尚未(?:接受|进行|实施)?手术|未行手术|未手术|待行手术|术前待手术/.test(value);
    const surgeryName = normalize(patient.surgeryName);
    const awaitingReviewedSurgery = surgeryName && ["拟行", "待行"].some((prefix) =>
      [sections.主诉, sections.处置].some((section) => section.includes(`${prefix}${surgeryName}`)));
    if (unoperated || awaitingReviewedSurgery || !/术后|切口|伤口/.test(`${sections.主诉}${sections.体征}${sections.处置}`)) {
      throw new Error(`${userid}的门诊病历摘要与术后方案阶段矛盾`);
    }
  }
}

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
  validateNoRedundantSemicolon(value, patient.userid, "AI药理科普");
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
  if (values.some((value) => metaCommentaryPattern.test(value.replace(/\s+/g, "")))) {
    throw new Error(`${fields.userid || "患者"}的健康管理方案不得出现辅助对症或事实状态说明文案，请直接写明用途、就诊信息或处理动作`);
  }
  if (values.some((value) => externalBasisPattern.test(value))) {
    throw new Error(`${fields.userid || "患者"}的健康管理方案不得引用审核处方、审核方案或已确认方案，请直接写明药品、用法和处理动作`);
  }
}

export function validatePharmacologyContent(text, patient) {
  validateNoRedundantSemicolon(text, patient.userid, "AI药理科普");
  const lines = normalize(text).split(/\r?\n/).map(normalize).filter(Boolean);
  for (const line of lines) {
    if (!patient.combinedMedication.some((medication) => line.startsWith(medication))
      && !(patient.surgeryName && line.startsWith(patient.surgeryName))) {
      throw new Error(`${patient.userid}的AI药理科普只能介绍患者的每种药品及已有手术或器械`);
    }
  }
}
