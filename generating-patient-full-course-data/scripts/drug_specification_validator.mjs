const strictDrugRules = new Map([
  ["注射用胰蛋白酶", {
    description: "效价单位（单位或万单位），不得使用mg或g等质量单位",
    specificationPattern: /^\d+(?:\.\d+)?(?:万)?单位(?:\/(?:支|瓶))?$/,
  }],
]);

function normalize(value) {
  return String(value ?? "").trim();
}

function extractSpecification(prescriptionEntry) {
  const match = normalize(prescriptionEntry).match(/规格\s*([^，；+]+)/);
  return normalize(match?.[1]).replace(/\s+/g, "");
}

function validateDosageFormPackage(userid, medication, specification) {
  if (/片$/.test(medication) && /\/粒(?:$|\b)/i.test(specification)) {
    throw new Error(`${userid}的${medication}规格${specification}不合规，片剂规格不得使用/粒包装单位`);
  }
  if (/(?:胶囊|胶囊剂)$/.test(medication) && /\/片(?:$|\b)/i.test(specification)) {
    throw new Error(`${userid}的${medication}规格${specification}不合规，胶囊剂规格不得使用/片包装单位`);
  }
}

export function validateDrugSpecification({ userid, medication, prescriptionEntry }) {
  const normalizedUserid = normalize(userid);
  const normalizedMedication = normalize(medication);
  const specification = extractSpecification(prescriptionEntry);
  if (!specification) {
    throw new Error(`${normalizedUserid}的${normalizedMedication}处方缺少可识别规格`);
  }
  if (!/\d/.test(specification) || !/\d(?:\.\d+)?(?:mg|g|μg|ug|mcg|ml|mL|L|%|万单位|单位|万IU|IU|万U|U)/.test(specification)) {
    throw new Error(`${normalizedUserid}的${normalizedMedication}规格${specification}缺少可识别的数值或计量单位`);
  }

  const strictRule = strictDrugRules.get(normalizedMedication);
  if (strictRule && !strictRule.specificationPattern.test(specification)) {
    throw new Error(`${normalizedUserid}的${normalizedMedication}规格${specification}不合规，应使用${strictRule.description}`);
  }

  validateDosageFormPackage(normalizedUserid, normalizedMedication, specification);
}
