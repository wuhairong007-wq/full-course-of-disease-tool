import assert from "node:assert/strict";
import { extractMedicationSpecification, validateMedicationListSpecification } from "./medication_specification.mjs";

assert.equal(
  extractMedicationSpecification("注射液 规格：5mg/支，每次5mg，肌内注射，每日1次，连续3天", "注射液"),
  "5mg/支",
);
assert.equal(
  extractMedicationSpecification("注射液 规格: 5mg/支，每次5mg，肌内注射，每日1次，连续3天", "注射液"),
  "5mg/支",
);
assert.equal(
  extractMedicationSpecification("注射液：5mg/支，每次5mg，肌内注射，每日1次，连续3天", "注射液"),
  "5mg/支",
);
assert.equal(
  extractMedicationSpecification("乳胶剂 规格：1%（20g/支），每次适量，局部外用，每日2次，连续7天", "乳胶剂"),
  "1%（20g/支）",
);
assert.equal(
  extractMedicationSpecification("注射液（5mg/支），每次5mg，肌内注射，每日1次，连续3天", "注射液"),
  "5mg/支",
);

assert.doesNotThrow(() => validateMedicationListSpecification({ userid: "U001", medication: "注射液", specification: "5mg/支" }));
assert.doesNotThrow(() => validateMedicationListSpecification({ userid: "U002", medication: "双氯芬酸二乙胺乳胶剂", specification: "1%（20g/支）" }));
assert.doesNotThrow(() => validateMedicationListSpecification({ userid: "U003", medication: "肾上腺素注射液", specification: "1:1000（1mg/mL）" }));
assert.throws(
  () => validateMedicationListSpecification({ userid: "U004", medication: "注射液", specification: "：5mg/支" }),
  /规格必须以数值开头/,
);
assert.throws(
  () => validateMedicationListSpecification({ userid: "U005", medication: "注射液", specification: "规格5mg/支" }),
  /规格必须以数值开头/,
);
assert.throws(
  () => validateMedicationListSpecification({ userid: "U006", medication: "对乙酰氨基酚片", specification: "0.5g/粒" }),
  /片剂规格不得使用\/粒包装单位/,
);

console.log(JSON.stringify({ status: "passed", normalizedCases: 5, validationCases: 6 }));
