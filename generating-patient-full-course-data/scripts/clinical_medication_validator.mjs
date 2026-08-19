const pediatricForbiddenPatterns = [
  /(?:左氧氟沙星|莫西沙星|环丙沙星|氧氟沙星|诺氟沙星)/,
  /(?:多西环素|米诺环素|四环素)/,
  /阿司匹林/,
];

const allergyMedicationRules = [
  { allergy: /青霉素/, medication: /(?:阿莫西林|氨苄西林|青霉素|哌拉西林|美洛西林)/ },
  { allergy: /β-内酰胺|β内酰胺/, medication: /(?:阿莫西林|氨苄西林|青霉素|哌拉西林|美洛西林|头孢|亚胺培南|美罗培南|厄他培南|氨曲南)/ },
  { allergy: /头孢/, medication: /头孢/ },
  { allergy: /磺胺/, medication: /(?:磺胺|复方磺胺甲噁唑)/ },
  { allergy: /阿司匹林/, medication: /阿司匹林/ },
];

export function validateClinicalMedicationSelection({
  userid,
  age,
  allergyHistory,
  productName,
  productType,
  medications,
}) {
  if (productType === "用药" && medications[0] !== productName) {
    throw new Error(`${userid}的药品类产品必须作为联合用药第一项：${productName}`);
  }
  if (Number(age) < 18) {
    const forbidden = medications.find((medication) => pediatricForbiddenPatterns.some((pattern) => pattern.test(medication)));
    if (forbidden) throw new Error(`${userid}未满18岁，不得使用${forbidden}`);
  }
  for (const rule of allergyMedicationRules) {
    if (!rule.allergy.test(allergyHistory)) continue;
    const conflictingMedication = medications.find((medication) => rule.medication.test(medication));
    if (conflictingMedication) {
      throw new Error(`${userid}存在${allergyHistory}，联合用药不得包含${conflictingMedication}`);
    }
  }
  for (const match of allergyHistory.matchAll(/([^，、；;\s]{2,20})过敏/g)) {
    const allergen = match[1].replace(/(?:药物|类)$/, "");
    if (!allergen || ["既往", "药品", "药物"].includes(allergen)) continue;
    const conflictingMedication = medications.find((medication) => medication.includes(allergen));
    if (conflictingMedication) {
      throw new Error(`${userid}存在${allergyHistory}，联合用药不得包含${conflictingMedication}`);
    }
  }
}
