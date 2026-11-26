import assert from "node:assert/strict";
import {
  PATIENT_DETAIL_HEADERS_16,
  PATIENT_DETAIL_HEADERS_17,
  PATIENT_DETAIL_HEADERS_18,
  PATIENT_PRESCRIPTION_HEADER,
  LEGACY_PATIENT_PRESCRIPTION_HEADER,
  parsePatientDetailHeaders,
} from "./patient_detail_headers.mjs";

assert.deepEqual(parsePatientDetailHeaders(PATIENT_DETAIL_HEADERS_16), {
  headers: PATIENT_DETAIL_HEADERS_16,
  hasConsumableName: true,
  prescriptionHeader: PATIENT_PRESCRIPTION_HEADER,
});
assert.deepEqual(parsePatientDetailHeaders(PATIENT_DETAIL_HEADERS_17), {
  headers: PATIENT_DETAIL_HEADERS_17,
  hasConsumableName: false,
  prescriptionHeader: PATIENT_PRESCRIPTION_HEADER,
});
assert.deepEqual(parsePatientDetailHeaders(PATIENT_DETAIL_HEADERS_18), {
  headers: PATIENT_DETAIL_HEADERS_18,
  hasConsumableName: true,
  prescriptionHeader: PATIENT_PRESCRIPTION_HEADER,
});
assert.equal(PATIENT_DETAIL_HEADERS_18[14], "耗材名称");
assert.equal(PATIENT_DETAIL_HEADERS_16.at(-1), "全病程方案名称");
for (const expected of [PATIENT_DETAIL_HEADERS_16, PATIENT_DETAIL_HEADERS_17, PATIENT_DETAIL_HEADERS_18]) {
  const manufacturerHeaders = expected.map(header => header === "联合用药" ? "关联厂家用药" : header);
  assert.deepEqual(parsePatientDetailHeaders(manufacturerHeaders), {
    headers: expected,
    hasConsumableName: expected.length !== 17,
    prescriptionHeader: PATIENT_PRESCRIPTION_HEADER,
  });
}
for (const expected of [PATIENT_DETAIL_HEADERS_16, PATIENT_DETAIL_HEADERS_17, PATIENT_DETAIL_HEADERS_18]) {
  const legacyHeaders = expected.map(header => header === PATIENT_PRESCRIPTION_HEADER ? LEGACY_PATIENT_PRESCRIPTION_HEADER : header);
  assert.deepEqual(parsePatientDetailHeaders(legacyHeaders), {
    headers: expected,
    hasConsumableName: expected.length !== 17,
    prescriptionHeader: LEGACY_PATIENT_PRESCRIPTION_HEADER,
  });
}
assert.throws(
  () => parsePatientDetailHeaders(PATIENT_DETAIL_HEADERS_16.map(header => (
    header === PATIENT_PRESCRIPTION_HEADER ? [PATIENT_PRESCRIPTION_HEADER, LEGACY_PATIENT_PRESCRIPTION_HEADER] : header
  )).flat()),
  /患者提供处方.*处方清单.*不能同时存在/,
);
assert.throws(
  () => parsePatientDetailHeaders([...PATIENT_DETAIL_HEADERS_18].reverse()),
  /固定16列当前表头、17列旧表头或18列兼容表头/,
);

console.log(JSON.stringify({ status: "passed", currentColumns: 16, legacyColumns: [17, 18] }));
