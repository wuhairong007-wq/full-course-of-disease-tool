function extractValue(text, label) {
  const pattern = new RegExp(`^${label}[：:][ \\t]*(.*)$`, 'm');
  const value = text.match(pattern)?.[1]?.trim();
  if (!value) throw new Error(`${label}不能为空`);
  return value;
}

function extractOptionalValue(text, label) {
  const pattern = new RegExp(`^${label}[：:][ \\t]*(.*)$`, 'm');
  return text.match(pattern)?.[1]?.trim() || null;
}

export function parseInsightRequest(text) {
  if (!text.includes('生成洞察报告')) throw new Error('缺少“生成洞察报告”触发词');

  const product = extractValue(text, '产品');
  const periodText = extractValue(text, '服务周期');
  const periodMatch = periodText.match(/^(\d{4}-\d{2}-\d{2})\s*至\s*(\d{4}-\d{2}-\d{2})$/);
  if (!periodMatch) throw new Error('服务周期格式应为 YYYY-MM-DD 至 YYYY-MM-DD');
  const [, start, end] = periodMatch;
  if (start > end) throw new Error('服务周期开始日期不能晚于结束日期');

  const templateMatch = text.match(/^输出Word文件模板[：:][ \t]*(.*)$/m);
  const templatePath = templateMatch?.[1]?.trim() || null;
  if (templatePath && !templatePath.toLowerCase().endsWith('.docx')) throw new Error('输出Word文件模板必须为 .docx');

  const client = extractOptionalValue(text, '委托方');
  const provider = extractOptionalValue(text, '服务商');

  const sourceStart = text.search(/依据以下文件[：:]/);
  const sourceTail = sourceStart >= 0 ? text.slice(sourceStart).replace(/^依据以下文件[：:]\s*/, '') : '';
  const sourceBlock = sourceTail.split(/输出Word文件模板[：:]/)[0];
  const sourcePaths = sourceBlock
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.toLowerCase().endsWith('.xlsx'));

  if (new Set(sourcePaths).size !== sourcePaths.length) throw new Error('依据文件路径存在重复');
  if (sourcePaths.length !== 7) throw new Error(`依据文件必须恰好包含7个 .xlsx 路径，当前为${sourcePaths.length}个`);

  return { product, period: { start, end }, sourcePaths, templatePath, client, provider };
}
