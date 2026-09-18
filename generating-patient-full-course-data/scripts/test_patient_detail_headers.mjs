import assert from "node:assert/strict";
import {
  PATIENT_DETAIL_HEADERS_16,
  PATIENT_DETAIL_HEADERS_17,
  PATIENT_DETAIL_HEADERS_18,
  parsePatientDetailHeaders,
} from "./patient_detail_headers.mjs";

assert.deepEqual(parsePatientDetailHeaders(PATIENT_DETAIL_HEADERS_16), {
  headers: PATIENT_DETAIL_HEADERS_16,
  hasConsumableName: true,
});
assert.deepEqual(parsePatientDetailHeaders(PATIENT_DETAIL_HEADERS_17), {
  headers: PATIENT_DETAIL_HEADERS_17,
  hasConsumableName: false,
});
assert.deepEqual(parsePatientDetailHeaders(PATIENT_DETAIL_HEADERS_18), {
  headers: PATIENT_DETAIL_HEADERS_18,
  hasConsumableName: true,
});
assert.equal(PATIENT_DETAIL_HEADERS_18[14], "耗材名称");
assert.equal(PATIENT_DETAIL_HEADERS_16.at(-1), "全病程方案名称");
assert.throws(
  () => parsePatientDetailHeaders([...PATIENT_DETAIL_HEADERS_18].reverse()),
  /固定16列当前表头、17列旧表头或18列兼容表头/,
);

console.log(JSON.stringify({ status: "passed", currentColumns: 16, legacyColumns: [17, 18] }));
