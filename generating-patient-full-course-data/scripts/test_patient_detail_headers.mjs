import assert from "node:assert/strict";
import {
  PATIENT_DETAIL_HEADERS_17,
  PATIENT_DETAIL_HEADERS_18,
  parsePatientDetailHeaders,
} from "./patient_detail_headers.mjs";

assert.deepEqual(parsePatientDetailHeaders(PATIENT_DETAIL_HEADERS_17), {
  headers: PATIENT_DETAIL_HEADERS_17,
  hasConsumableName: false,
});
assert.deepEqual(parsePatientDetailHeaders(PATIENT_DETAIL_HEADERS_18), {
  headers: PATIENT_DETAIL_HEADERS_18,
  hasConsumableName: true,
});
assert.equal(PATIENT_DETAIL_HEADERS_18[14], "耗材名称");
assert.throws(
  () => parsePatientDetailHeaders([...PATIENT_DETAIL_HEADERS_18].reverse()),
  /固定17列旧表头或固定18列新表头/,
);

console.log(JSON.stringify({ status: "passed", legacyColumns: 17, currentColumns: 18 }));
