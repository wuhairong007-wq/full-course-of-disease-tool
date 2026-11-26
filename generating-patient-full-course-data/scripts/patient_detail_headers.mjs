import { getMedicationColumn, MANUFACTURER_MEDICATION_COLUMN } from "./medication_column.mjs";

export const PATIENT_PRESCRIPTION_HEADER = "患者提供处方";
export const LEGACY_PATIENT_PRESCRIPTION_HEADER = "处方清单";

export const PATIENT_DETAIL_HEADERS_17 = [
  "序号", "userid", "患者姓名", "激活时间", "性别", "年龄", "疾病", "手机号码", "地区",
  "患者标签", "既往过敏史", "联合用药", PATIENT_PRESCRIPTION_HEADER, "手术名称", "全病程方案名称", "AI状态", "确认状态",
];

export const PATIENT_DETAIL_HEADERS_18 = [
  ...PATIENT_DETAIL_HEADERS_17.slice(0, 14),
  "耗材名称",
  ...PATIENT_DETAIL_HEADERS_17.slice(14),
];

export const PATIENT_DETAIL_HEADERS_16 = PATIENT_DETAIL_HEADERS_18.slice(0, 16);

export function parsePatientDetailHeaders(headers) {
  getMedicationColumn(headers);
  const normalized = headers.map((value) => String(value ?? "").trim());
  const prescriptionHeaders = normalized.filter(header => (
    header === PATIENT_PRESCRIPTION_HEADER || header === LEGACY_PATIENT_PRESCRIPTION_HEADER
  ));
  if (new Set(prescriptionHeaders).size > 1) {
    throw new Error("患者提供处方和处方清单不能同时存在");
  }
  if (prescriptionHeaders.length > 1) throw new Error("患者提供处方字段重复");
  const prescriptionHeader = prescriptionHeaders[0] ?? PATIENT_PRESCRIPTION_HEADER;
  const canonical = normalized
    .map(header => header === MANUFACTURER_MEDICATION_COLUMN ? "联合用药" : header)
    .map(header => header === LEGACY_PATIENT_PRESCRIPTION_HEADER ? PATIENT_PRESCRIPTION_HEADER : header);
  if (JSON.stringify(canonical) === JSON.stringify(PATIENT_DETAIL_HEADERS_16)) {
    return { headers: PATIENT_DETAIL_HEADERS_16, hasConsumableName: true, prescriptionHeader };
  }
  if (JSON.stringify(canonical) === JSON.stringify(PATIENT_DETAIL_HEADERS_18)) {
    return { headers: PATIENT_DETAIL_HEADERS_18, hasConsumableName: true, prescriptionHeader };
  }
  if (JSON.stringify(canonical) === JSON.stringify(PATIENT_DETAIL_HEADERS_17)) {
    return { headers: PATIENT_DETAIL_HEADERS_17, hasConsumableName: false, prescriptionHeader };
  }
  throw new Error("患者明细必须使用固定16列当前表头、17列旧表头或18列兼容表头及顺序");
}
