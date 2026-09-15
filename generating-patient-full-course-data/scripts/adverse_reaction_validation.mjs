const recordKeys = ["userid", "symptomDescription", "treatmentMeasures", "outcome", "remarks"];
const normalize = (value) => String(value ?? "").trim();
const medicationNamePattern = /(?:给予|使用|加用|服用|停用|改用|调整)?([\u4e00-\u9fa5A-Za-z0-9α-ωΑ-Ω-]{2,30}(?:肠溶片|缓释片|分散片|咀嚼片|含片|片|胶囊|颗粒|丸|口服液|糖浆|混悬液|注射液|注射剂|吸入剂|喷雾剂|滴眼液|滴鼻液|乳膏|软膏|凝胶|贴剂))/g;
const normalizeProductText = (value) => normalize(value).normalize("NFKC").replace(/[\s\u200B-\u200D\uFEFF]/g, "").toLowerCase();

function validateSymptomProductExclusion(symptomDescription, patient) {
  const text = normalizeProductText(symptomDescription);
  const product = normalizeProductText(patient.productName);
  // Check the ingredient shorthand as well as the full dosage-form name.
  const shortName = product.replace(/^注射用/, "").replace(/(?:肠溶胶囊|缓释胶囊|肠溶片|缓释片|分散片|咀嚼片|口服液|混悬液|注射液|注射剂|吸入剂|喷雾剂|滴眼液|滴鼻液|滴耳液|胶囊|颗粒|糖浆|乳膏|软膏|凝胶|贴剂|片|丸)$/, "");
  const names = [product, shortName.length >= 2 ? shortName : ""].filter(Boolean);
  if (names.some((name) => text.includes(name)) || /(?:本品|该产品|本产品|当前产品|目标产品|该药品|本药品|该药物|本药物|该药|本药|该器械|本器械)/.test(text)) {
    throw new Error(`${patient.userid}的不良反应症状描述不能包含当前产品信息；请保留症状、部位、程度及发生变化，重写后再导出`);
  }
}

export function validateAdverseReactionRecord(record, patient) {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`${patient.userid}记录必须为对象`);
  if (JSON.stringify(Object.keys(record)) !== JSON.stringify(recordKeys)) throw new Error(`${patient.userid}必须且只能依次包含5个字段`);
  if (record.userid !== patient.userid) throw new Error(`${patient.userid}的userid被改变`);
  for (const key of recordKeys.slice(1)) if (!normalize(record[key])) throw new Error(`${patient.userid}的${key}不能为空`);
  validateSymptomProductExclusion(record.symptomDescription, patient);
  for (const key of recordKeys.slice(1)) {
    if (/\b(?:T|P|BP|SpO2)\s*\d|\d+(?:\.\d+)?\s*(?:℃|mmHg|次\/分|%)/i.test(record[key])) throw new Error(`${patient.userid}的${key}不得虚构检查或生命体征数值`);
  }
  const clinicalText = recordKeys.slice(1).map((key) => normalize(record[key])).join("\n");
  const allowedMedicationText = `${patient.combinedMedication}\n${patient.prescriptionList}`;
  for (const match of clinicalText.matchAll(medicationNamePattern)) {
    const medicationName = match[1];
    if (!allowedMedicationText.includes(medicationName)) throw new Error(`${patient.userid}不得引入处方清单之外的药物：${medicationName}`);
  }
  if (/(?:完全恢复|完全康复|痊愈|治愈|指标恢复正常|生命体征恢复正常|检查结果正常)/.test(record.outcome)) {
    throw new Error(`${patient.userid}的处理结果不得承诺完全恢复或虚构指标正常`);
  }
  if (/(?:立即|已经|已)?(?:收入院|住院治疗)|(?:已经|已|完成)(?:[^。；，]{0,12})(?:检查|化验|影像)|完成[^。；，]{0,20}检查|(?:检查|化验|影像)(?:显示|提示|证实)/.test(clinicalText)) {
    throw new Error(`${patient.userid}不得虚构住院或已完成的检查处置`);
  }
  if (/(?:确诊为|诊断为|证实为)[^。；，]+/.test(clinicalText)) throw new Error(`${patient.userid}不得新增或确认源文件未提供的诊断`);
  if (patient.allergyHistory !== "无" && !record.remarks.includes(patient.allergyHistory)) throw new Error(`${patient.userid}的备注必须提示既往过敏史`);
  if (patient.adverseReactionLevel === "高度" && !/(?:立即|急诊|紧急|专科|医生|人工干预|医疗机构)/.test(record.treatmentMeasures)) {
    throw new Error(`${patient.userid}高度患者的处理措施必须体现紧急评估或专科干预`);
  }
}
