export const MANUFACTURER_MEDICATION_COLUMN = "关联厂家用药";
const normalize = value => String(value ?? "").trim();

export function getMedicationColumn(headers) {
  const columns = headers.map(normalize).filter(header => ["联合用药", MANUFACTURER_MEDICATION_COLUMN].includes(header));
  if (new Set(columns).size > 1) throw new Error("不能同时包含联合用药和关联厂家用药字段");
  if (columns.length > 1) throw new Error("用药字段重复");
  return columns[0] ?? "联合用药";
}

export function resolveMedicationMinimum(column, requested) {
  if (requested !== undefined && !/^[1-5]$/.test(String(requested))) throw new Error("最少种数必须为1～5的整数");
  if (column === MANUFACTURER_MEDICATION_COLUMN) {
    if (requested !== undefined && Number(requested) !== 1) throw new Error("关联厂家用药只能设置最少种数为1");
    return 1;
  }
  return Number(requested ?? 3);
}

export function parseMedicationCell(value, column, userid) {
  const medications = normalize(value).split("+").map(normalize).filter(Boolean);
  if (!medications.length) throw new Error(`${userid}的${column}不能为空`);
  if (column === MANUFACTURER_MEDICATION_COLUMN && medications.length !== 1) {
    throw new Error(`${userid}的关联厂家用药必须只有一种用药`);
  }
  if (new Set(medications).size !== medications.length) throw new Error(`${userid}的${column}存在重复`);
  return medications;
}

export function validateManufacturerMedication({ userid, productName, productType, medications }) {
  if (productType !== "用药") throw new Error(`${userid}的关联厂家用药仅支持药品，不能将器械作为用药`);
  if (!normalize(productName) || medications?.length !== 1 || medications[0] !== productName) {
    throw new Error(`${userid}的关联厂家用药必须且只能等于当前产品名称：${productName}`);
  }
}
