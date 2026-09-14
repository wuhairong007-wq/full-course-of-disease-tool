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
  if (![6, 7].includes(sourcePaths.length)) throw new Error(`依据文件须包含6或7个 .xlsx 路径（六类必填，不良反应清单选填），当前为${sourcePaths.length}个`);

  return { product, period: { start, end }, sourcePaths, templatePath, client, provider };
}

export function parseDeepInterviewRequest(text) {
  if (!text.includes('生成深度访谈')) throw new Error('缺少“生成深度访谈”触发词');
  const researchTime = extractValue(text, '调研时间');
  const countMatch = extractValue(text, '调研数量').match(/^(\d+)\s*人?$/);
  if (!countMatch || Number(countMatch[1]) < 1) throw new Error('调研数量必须为正整数，可带“人”');
  const mildMatch = text.match(/^是否轻度[：:][ \t]*(.*)$/m);
  const mildText = mildMatch ? mildMatch[1].trim() : '否';
  if (!['是', '否'].includes(mildText)) throw new Error('是否轻度只能填写“是”或“否”');
  const normalizePath = (line) => line.trim().replace(/\\+_/g, '_').replace(/\\+$/, '').trim();
  const sourceTail = text.split(/依据以下文件[：:]/)[1] || '';
  const blocks = sourceTail.split(/输出文件模板[：:]/);
  const sourcePaths = blocks[0].split(/\r?\n/).map(normalizePath).filter(Boolean);
  if (sourcePaths.some((p) => !p.toLowerCase().endsWith('.xlsx'))) throw new Error('依据文件必须为 .xlsx');
  if (new Set(sourcePaths).size !== sourcePaths.length) throw new Error('依据文件路径存在重复');
  if (![5, 6].includes(sourcePaths.length)) throw new Error(`深度访谈须提供5或6个 .xlsx 文件，当前为${sourcePaths.length}个`);
  const templatePaths = (blocks[1] || '').split(/\r?\n/).map(normalizePath).filter(Boolean);
  if (templatePaths.length && (templatePaths.length !== 2 || templatePaths.some((p) => !p.toLowerCase().endsWith('.docx')))) throw new Error('输出文件模板须为两份 .docx');
  return { researchTime, count: Number(countMatch[1]), includeMild: mildText === '是', sourcePaths, templatePaths };
}
