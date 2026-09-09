import assert from "node:assert/strict";
import { validateClinicalMedicationSelection } from "./clinical_medication_validator.mjs";

const base = {
  userid: "U001",
  age: 42,
  gender: "女",
  disease: "原发性膝骨关节炎",
  allergyHistory: "无",
  productName: "硫酸氨基葡萄糖胶囊",
  productType: "用药",
  medications: ["硫酸氨基葡萄糖胶囊", "双氯芬酸二乙胺乳胶剂", "对乙酰氨基酚片"],
};

assert.doesNotThrow(() => validateClinicalMedicationSelection(base));
assert.doesNotThrow(() => validateClinicalMedicationSelection({
  ...base,
  company: "山东利赛医药有限公司",
  medications: ["双氯芬酸二乙胺乳胶剂", "对乙酰氨基酚片"],
}));
assert.throws(
  () => validateClinicalMedicationSelection({
    ...base,
    company: "山东利赛医药有限公司",
    medications: ["硫酸氨基葡萄糖胶囊", "对乙酰氨基酚片"],
  }),
  /山东利赛医药有限公司.*产品名称.*硫酸氨基葡萄糖胶囊.*不得进入联合用药/,
);
assert.doesNotThrow(() => validateClinicalMedicationSelection({
  ...base,
  company: "其他公司",
  medications: ["硫酸氨基葡萄糖胶囊", "双氯芬酸二乙胺乳胶剂"],
}));
assert.throws(
  () => validateClinicalMedicationSelection({ ...base, medications: ["对乙酰氨基酚片", "硫酸氨基葡萄糖胶囊", "双氯芬酸二乙胺乳胶剂"] }),
  /药品类产品必须作为联合用药第一项/,
);
assert.throws(
  () => validateClinicalMedicationSelection({ ...base, age: 12, medications: ["硫酸氨基葡萄糖胶囊", "左氧氟沙星片", "对乙酰氨基酚片"] }),
  /未满18岁.*左氧氟沙星片/,
);
assert.throws(
  () => validateClinicalMedicationSelection({ ...base, allergyHistory: "青霉素过敏", medications: ["硫酸氨基葡萄糖胶囊", "阿莫西林胶囊", "对乙酰氨基酚片"] }),
  /青霉素过敏.*阿莫西林胶囊/,
);
assert.throws(
  () => validateClinicalMedicationSelection({ ...base, allergyHistory: "布洛芬过敏", medications: ["硫酸氨基葡萄糖胶囊", "布洛芬缓释胶囊", "对乙酰氨基酚片"] }),
  /布洛芬过敏.*布洛芬缓释胶囊/,
);
assert.throws(
  () => validateClinicalMedicationSelection({ ...base, allergyHistory: "对布洛芬过敏", medications: ["硫酸氨基葡萄糖胶囊", "布洛芬缓释胶囊"] }),
  /对布洛芬过敏.*布洛芬缓释胶囊/,
);
assert.throws(
  () => validateClinicalMedicationSelection({ ...base, allergyHistory: "对布洛芬、双氯芬酸过敏", medications: ["硫酸氨基葡萄糖胶囊", "布洛芬缓释胶囊"] }),
  /对布洛芬、双氯芬酸过敏.*布洛芬缓释胶囊/,
);
assert.throws(
  () => validateClinicalMedicationSelection({ ...base, allergyHistory: "喹诺酮类药物过敏", medications: ["硫酸氨基葡萄糖胶囊", "左氧氟沙星片"] }),
  /喹诺酮类药物过敏.*左氧氟沙星片/,
);
assert.throws(
  () => validateClinicalMedicationSelection({
    ...base,
    allergyHistory: "对布洛芬过敏",
    productName: "布洛芬缓释胶囊",
    medications: ["对乙酰氨基酚片"],
  }),
  /对布洛芬过敏.*产品名称.*布洛芬缓释胶囊/,
);
assert.doesNotThrow(() => validateClinicalMedicationSelection({
  ...base,
  allergyHistory: "否认药物过敏",
  medications: ["硫酸氨基葡萄糖胶囊", "布洛芬缓释胶囊"],
}));
assert.throws(
  () => validateClinicalMedicationSelection({
    ...base,
    allergyHistory: "否认其他药物过敏，青霉素过敏",
    medications: ["硫酸氨基葡萄糖胶囊", "阿莫西林胶囊"],
  }),
  /青霉素过敏.*阿莫西林胶囊/,
);
assert.throws(
  () => validateClinicalMedicationSelection({
    ...base,
    allergyHistory: "布洛芬缓释胶囊过敏",
    medications: ["硫酸氨基葡萄糖胶囊", "布洛芬片"],
  }),
  /布洛芬缓释胶囊过敏.*布洛芬片/,
);

console.log(JSON.stringify({ status: "passed", cases: 15 }));
