function normalize(value) {
  return String(value ?? "").trim();
}

/**
 * Validate the plan name without rewriting or sanitizing the patient's disease.
 * The source disease is the clinical anchor; phase/management wording may follow it.
 */
export function validateCoursePlanName({ userid, disease, coursePlanName, productName }) {
  const plan = normalize(coursePlanName);
  const sourceDisease = normalize(disease);
  const sourceProduct = normalize(productName);
  const id = normalize(userid) || "患者";

  if (!plan) throw new Error(`${id}的coursePlanName不能为空`);
  if (sourceProduct && plan.includes(sourceProduct)) {
    throw new Error(`${id}的方案名称不得出现产品名称`);
  }
  if (sourceDisease && !plan.includes(sourceDisease)) {
    throw new Error(`${id}的方案名称必须体现源疾病名称；必须保留源疾病名称原文“${sourceDisease}”，不得为跨疾病通用方案名或同义改写`);
  }
}
