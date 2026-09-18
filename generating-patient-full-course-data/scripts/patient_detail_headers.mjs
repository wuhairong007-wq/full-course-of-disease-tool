export const PATIENT_DETAIL_HEADERS_17 = [
  "序号", "userid", "患者姓名", "激活时间", "性别", "年龄", "疾病", "手机号码", "地区",
  "患者标签", "既往过敏史", "联合用药", "处方清单", "手术名称", "全病程方案名称", "AI状态", "确认状态",
];

export const PATIENT_DETAIL_HEADERS_18 = [
  ...PATIENT_DETAIL_HEADERS_17.slice(0, 14),
  "耗材名称",
  ...PATIENT_DETAIL_HEADERS_17.slice(14),
];

export function parsePatientDetailHeaders(headers) {
  const normalized = headers.map((value) => String(value ?? "").trim());
  if (JSON.stringify(normalized) === JSON.stringify(PATIENT_DETAIL_HEADERS_18)) {
    return { headers: PATIENT_DETAIL_HEADERS_18, hasConsumableName: true };
  }
  if (JSON.stringify(normalized) === JSON.stringify(PATIENT_DETAIL_HEADERS_17)) {
    return { headers: PATIENT_DETAIL_HEADERS_17, hasConsumableName: false };
  }
  throw new Error("患者明细必须使用固定17列旧表头或固定18列新表头及顺序");
}
