const pediatricForbiddenPatterns = [
  /(?:左氧氟沙星|莫西沙星|环丙沙星|氧氟沙星|诺氟沙星)/,
  /(?:多西环素|米诺环素|四环素)/,
  /阿司匹林/,
];

const allergyClassRules = [
  { allergy: /青霉素/, medication: /(?:阿莫西林|氨苄西林|青霉素|哌拉西林|美洛西林)/ },
  { allergy: /β-内酰胺|β内酰胺/, medication: /(?:阿莫西林|氨苄西林|青霉素|哌拉西林|美洛西林|头孢|亚胺培南|美罗培南|厄他培南|氨曲南)/ },
  { allergy: /头孢(?:菌素)?/, medication: /头孢/ },
  { allergy: /磺胺/, medication: /(?:磺胺|复方磺胺甲噁唑)/ },
  { allergy: /(?:氟)?喹诺酮/, medication: /(?:左氧氟沙星|莫西沙星|环丙沙星|氧氟沙星|诺氟沙星|吉米沙星)/ },
  { allergy: /大环内酯/, medication: /(?:阿奇霉素|克拉霉素|红霉素|罗红霉素|螺旋霉素)/ },
  { allergy: /四环素/, medication: /(?:多西环素|米诺环素|四环素)/ },
  { allergy: /氨基糖苷/, medication: /(?:庆大霉素|阿米卡星|妥布霉素|链霉素|奈替米星|依替米星)/ },
  { allergy: /硝基咪唑/, medication: /(?:甲硝唑|替硝唑|奥硝唑|塞克硝唑)/ },
  { allergy: /(?:非甾体抗炎药|非甾体类抗炎药|NSAIDs?)/i, medication: /(?:阿司匹林|布洛芬|双氯芬酸|氟比洛芬|萘普生|吲哚美辛|洛索洛芬|美洛昔康|塞来昔布|依托考昔)/ },
];

const noKnownDrugAllergyPattern = /^(?:无|否|无(?:明确)?(?:药物|药品)过敏史|否认(?:其他)?(?:药物|药品)过敏(?:史)?|未发现(?:药物|药品)过敏(?:史)?)$/;
const negatedAllergyClausePattern = /^(?:否认|无|未发现|未诉).*(?:过敏|过敏史)$/;
const ignoredAllergyTerms = new Set(["无", "否", "既往", "药品", "药物", "不详"]);
const dosageFormSuffixPattern = /(?:缓释|控释|肠溶|分散|咀嚼|泡腾)?(?:片|胶囊|颗粒|混悬液|口服液|注射液|乳膏剂?|软膏剂?|凝胶剂?|滴眼液|滴鼻液|喷雾剂|吸入剂|阴道片|栓剂?|丸剂?|散剂?|粉针剂|注射剂)$/;
const productExclusionCompany = "山东利赛医药有限公司";

function cleanAllergyTerm(value) {
  return String(value ?? "")
    .trim()
    .replace(/^(?:既往(?:有)?|曾(?:经)?(?:有)?|有|对)+/, "")
    .replace(/(?:相关)?(?:药物|药品|制剂)?类$/, "")
    .replace(/(?:药物|药品|制剂)$/, "")
    .trim();
}

function extractAllergyTerms(allergyHistory) {
  const normalized = String(allergyHistory ?? "").trim();
  if (!normalized || noKnownDrugAllergyPattern.test(normalized)) return [];

  const terms = new Set();
  const addTerms = (value) => {
    for (const item of String(value ?? "").split(/[、/]|以及|及|和|与/)) {
      const term = cleanAllergyTerm(item);
      if (term.length >= 2 && !ignoredAllergyTerms.has(term)) terms.add(term);
    }
  };

  for (const clause of normalized.split(/[，,；;。]/)) {
    const trimmedClause = clause.trim();
    if (!trimmedClause || negatedAllergyClausePattern.test(trimmedClause)) continue;
    const labelledHistory = trimmedClause.match(/(?:药物|药品)?过敏史\s*[:：]\s*(.+)$/);
    if (labelledHistory) {
      addTerms(labelledHistory[1]);
      continue;
    }
    const allergyStatement = trimmedClause.match(/(.+?)过敏(?:史)?$/);
    if (allergyStatement) addTerms(allergyStatement[1]);
  }
  if (terms.size === 0 && !/过敏/.test(normalized)) addTerms(normalized.replace(/^(?:药物|药品)?过敏史\s*[:：]\s*/, ""));
  return [...terms];
}

function normalizeMedicationIngredient(value) {
  return String(value ?? "").trim().replace(dosageFormSuffixPattern, "");
}

function conflictsWithAllergy(medication, allergyTerms) {
  const normalizedMedication = normalizeMedicationIngredient(medication);
  if (allergyTerms.some((allergen) => {
    const normalizedAllergen = normalizeMedicationIngredient(allergen);
    return normalizedAllergen.length >= 2 && normalizedMedication.includes(normalizedAllergen);
  })) return true;
  return allergyClassRules.some((rule) => (
    allergyTerms.some((allergen) => rule.allergy.test(allergen)) && rule.medication.test(medication)
  ));
}

function normalize(value) {
  return String(value ?? "").trim();
}

export function shouldExcludeMedicinalProduct({ company, productType }) {
  return normalize(company) === productExclusionCompany && normalize(productType) === "用药";
}

export function validateClinicalMedicationSelection({
  userid,
  age,
  allergyHistory,
  productName,
  productType,
  company,
  medications,
}) {
  const allergyTerms = extractAllergyTerms(allergyHistory);
  const excludeProduct = shouldExcludeMedicinalProduct({ company, productType });
  if (excludeProduct && medications.includes(productName)) {
    throw new Error(`${userid}在${productExclusionCompany}场景下，产品名称${productName}不得进入联合用药`);
  }
  if (!excludeProduct && productType === "用药" && conflictsWithAllergy(productName, allergyTerms)) {
    throw new Error(`${userid}存在${allergyHistory}，产品名称${productName}与既往过敏史冲突`);
  }
  if (!excludeProduct && productType === "用药" && medications[0] !== productName) {
    throw new Error(`${userid}的药品类产品必须作为联合用药第一项：${productName}`);
  }
  if (Number(age) < 18) {
    const forbidden = medications.find((medication) => pediatricForbiddenPatterns.some((pattern) => pattern.test(medication)));
    if (forbidden) throw new Error(`${userid}未满18岁，不得使用${forbidden}`);
  }
  const conflictingMedication = medications.find((medication) => conflictsWithAllergy(medication, allergyTerms));
  if (conflictingMedication) {
    throw new Error(`${userid}存在${allergyHistory}，联合用药不得包含${conflictingMedication}`);
  }
}
