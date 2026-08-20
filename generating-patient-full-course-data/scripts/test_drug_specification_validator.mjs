import assert from "node:assert/strict";
import { validateDrugSpecification } from "./drug_specification_validator.mjs";

assert.doesNotThrow(() => validateDrugSpecification({
  userid: "U003",
  medication: "注射用胰蛋白酶",
  prescriptionEntry: "注射用胰蛋白酶 规格5万单位/支，每次5万单位，静脉注射，每日1次，治疗期间按医嘱复核，连续3天",
}));

assert.doesNotThrow(() => validateDrugSpecification({
  userid: "U005",
  medication: "重组人表皮生长因子凝胶",
  prescriptionEntry: "重组人表皮生长因子凝胶 规格10万IU/支，每次1g，外用，每日1次，每日换药时，连续14天",
}));

assert.throws(() => validateDrugSpecification({
  userid: "U003",
  medication: "注射用胰蛋白酶",
  prescriptionEntry: "注射用胰蛋白酶 规格5mg，每次5mg，静脉注射，每日1次，治疗期间按医嘱复核，连续3天",
}), /U003.*注射用胰蛋白酶.*5mg.*效价单位/);

assert.throws(() => validateDrugSpecification({
  userid: "U004",
  medication: "对乙酰氨基酚片",
  prescriptionEntry: "对乙酰氨基酚片 规格0.5g/粒，每次0.5g，口服，每日1次，餐后服用，连续3天",
}), /U004.*对乙酰氨基酚片.*0.5g\/粒.*片剂规格/);

console.log(JSON.stringify({ status: "passed", rules: 2 }));
