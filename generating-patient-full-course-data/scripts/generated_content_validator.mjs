const prohibitedPlaceholderPatterns = [
  /源文件|源数据|原始文件|输入文件|输入数据/,
  /原表|输入表格|源表/,
  /未提供|没有提供|未获取|未记录|未说明|未注明/,
  /无法获取|无法取得|无法得知|无从得知/,
  /没有(?:相关)?(?:资料|信息|记录|数据|结果|字段)/,
  /缺少(?:相关)?(?:资料|信息|记录|数据|结果|字段)/,
  /(?:情况|资料|信息|记录|数据|结果)不详/,
  /暂无(?:相关)?(?:资料|信息|记录|数据|结果)?/,
  /(?:资料|信息|记录|数据)(?:不足|缺失)/,
];

function visitGeneratedValue(value, path, visitor) {
  if (typeof value === "string") {
    visitor(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => visitGeneratedValue(item, `${path}[${index}]`, visitor));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      visitGeneratedValue(item, path ? `${path}.${key}` : key, visitor);
    }
  }
}

export function validateGeneratedContent({ userid, fields }) {
  visitGeneratedValue(fields, "", (text, fieldPath) => {
    const matchedPattern = prohibitedPlaceholderPatterns.find((pattern) => pattern.test(text));
    if (matchedPattern) {
      throw new Error(`${userid}的${fieldPath || "生成内容"}含描述输入缺失或引用源文件的占位文案`);
    }
  });
}
