import assert from "node:assert/strict";
import { determineOsteoarthritisStratum, selectOsteoarthritisMedication } from "./osteoarthritis_medication_selector.mjs";

const basePatient = {
  userid: "U001",
  disease: "原发性膝骨关节炎",
  allergyHistory: "无",
  productName: "硫酸氨基葡萄糖胶囊",
  productType: "用药",
};

assert.equal(determineOsteoarthritisStratum({ ...basePatient, userid: "U1" }), "轻度疼痛");
assert.equal(determineOsteoarthritisStratum({ ...basePatient, userid: "U0" }), "中度疼痛伴炎症表现");
assert.equal(determineOsteoarthritisStratum({ ...basePatient, userid: "U2" }), "重度持续疼痛伴炎症表现");
assert.equal(
  determineOsteoarthritisStratum({ ...basePatient, userid: "U2" }),
  determineOsteoarthritisStratum({ ...basePatient, userid: "U2" }),
);

assert.deepEqual(
  selectOsteoarthritisMedication({ ...basePatient, userid: "U1" }).combinedMedication,
  ["硫酸氨基葡萄糖胶囊"],
);
assert.deepEqual(
  selectOsteoarthritisMedication({ ...basePatient, userid: "U0" }).combinedMedication,
  ["硫酸氨基葡萄糖胶囊", "氟比洛芬凝胶贴膏"],
);
assert.deepEqual(
  selectOsteoarthritisMedication({ ...basePatient, userid: "U2" }).combinedMedication,
  ["硫酸氨基葡萄糖胶囊", "氟比洛芬凝胶贴膏", "对乙酰氨基酚片"],
);
assert.deepEqual(
  selectOsteoarthritisMedication({
    ...basePatient,
    userid: "U2",
    allergyHistory: "非甾体抗炎药过敏",
  }).combinedMedication,
  ["硫酸氨基葡萄糖胶囊", "对乙酰氨基酚片"],
);

console.log(JSON.stringify({ status: "passed", cases: 8 }));
