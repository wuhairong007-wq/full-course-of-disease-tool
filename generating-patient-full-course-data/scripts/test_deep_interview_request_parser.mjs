import assert from 'node:assert/strict';
import { parseDeepInterviewRequest } from './insight_request_parser.mjs';
const base = `生成深度访谈
调研时间：2026年6月
调研数量：10人
依据以下文件：
/a/patients.xlsx
/a/plans.xlsx
/a/tracking.xlsx
/a/followups.xlsx
/a/symptoms.xlsx
/a/ae.xlsx
输出文件模板：
/a/report.docx
/a/details.docx`;
assert.equal(parseDeepInterviewRequest(base).includeMild, false);
assert.equal(parseDeepInterviewRequest(base.replace('依据以下文件：', '是否轻度：是\n依据以下文件：')).includeMild, true);
assert.equal(parseDeepInterviewRequest(base.replace('依据以下文件：', '是否轻度：否\n依据以下文件：')).includeMild, false);
assert.equal(parseDeepInterviewRequest(base).count, 10);
assert.equal(parseDeepInterviewRequest(base).templatePaths.length, 2);
for (const value of ['', 'true', '轻度', 'yes']) {
  assert.throws(() => parseDeepInterviewRequest(base.replace('依据以下文件：', `是否轻度：${value}\n依据以下文件：`)), /是否轻度只能/);
}
console.log('Deep interview optional severity parser tests passed');
