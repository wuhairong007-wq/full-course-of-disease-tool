import assert from "node:assert/strict";
import {
  getMedicationColumn,
  resolveMedicationMinimum,
  parseMedicationCell,
  validateManufacturerMedication,
} from "./medication_column.mjs";

assert.equal(getMedicationColumn(["产品名称"]), "联合用药");
assert.equal(getMedicationColumn(["联合用药"]), "联合用药");
assert.equal(getMedicationColumn(["关联厂家用药"]), "关联厂家用药");
assert.throws(() => getMedicationColumn(["联合用药", "关联厂家用药"]), /同时/);
assert.throws(() => getMedicationColumn(["关联厂家用药", "关联厂家用药"]), /重复/);
assert.equal(resolveMedicationMinimum("联合用药"), 3);
assert.equal(resolveMedicationMinimum("关联厂家用药"), 1);
assert.equal(resolveMedicationMinimum("关联厂家用药", "1"), 1);
assert.throws(() => resolveMedicationMinimum("关联厂家用药", "3"), /只能.*1/);
assert.deepEqual(parseMedicationCell("药品甲+药品乙", "联合用药", "U1"), ["药品甲", "药品乙"]);
assert.deepEqual(parseMedicationCell(" 药品甲 ", "关联厂家用药", "U1"), ["药品甲"]);
assert.throws(() => parseMedicationCell("药品甲+药品乙", "关联厂家用药", "U1"), /一种/);
assert.throws(() => parseMedicationCell("", "关联厂家用药", "U1"), /不能为空/);
assert.doesNotThrow(() => validateManufacturerMedication({
  userid: "U1", productName: "药品甲", productType: "用药", medications: ["药品甲"],
}));
assert.throws(() => validateManufacturerMedication({
  userid: "U1", productName: "药品甲", productType: "用药", medications: ["药品乙"],
}), /当前产品名称/);
assert.throws(() => validateManufacturerMedication({
  userid: "U1", productName: "器械甲", productType: "器械", medications: ["器械甲"],
}), /器械/);
console.log(JSON.stringify({ status: "passed", suite: "medication column" }));
