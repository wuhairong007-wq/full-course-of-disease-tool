import assert from 'node:assert/strict';
import { parseInsightRequest } from './insight_request_parser.mjs';

const prompt = `生成洞察报告
产品：注射用胰蛋白酶
服务周期：2026-07-01 至 2026-07-31
依据以下文件：
患者全病程数据.xlsx
健康管理方案.xlsx
跟踪提醒.xlsx
智能随访明细.xlsx
症状自评明细.xlsx
用药清单.xlsx
不良反应清单.xlsx
输出Word文件模板：06-患者洞察报告.docx`;

const request = parseInsightRequest(prompt);
assert.equal(request.product, '注射用胰蛋白酶');
assert.deepEqual(request.period, { start: '2026-07-01', end: '2026-07-31' });
assert.equal(request.sourcePaths.length, 7);
assert.equal(request.templatePath, '06-患者洞察报告.docx');

const noTemplatePrompt = `生成洞察报告
产品：注射用胰蛋白酶
服务周期： 2026-07-01 至 2026-07-31
依据以下文件：
/绝对路径/患者主表.xlsx
/绝对路径/健康管理方案.xlsx
/绝对路径/跟踪提醒.xlsx
/绝对路径/智能随访.xlsx
/绝对路径/症状自评.xlsx
/绝对路径/用药清单.xlsx
/绝对路径/不良反应清单.xlsx`;
const noTemplateRequest = parseInsightRequest(noTemplatePrompt);
assert.equal(noTemplateRequest.templatePath, null);
assert.deepEqual(noTemplateRequest.period, { start: '2026-07-01', end: '2026-07-31' });

assert.throws(() => parseInsightRequest(prompt.replace('产品：注射用胰蛋白酶', '产品：')), /产品/);
assert.throws(() => parseInsightRequest(prompt.replace('2026-07-01 至 2026-07-31', '2026-07-31 至 2026-07-01')), /服务周期/);
assert.throws(() => parseInsightRequest(prompt.replace('不良反应清单.xlsx\n', '')), /7/);
assert.throws(() => parseInsightRequest(prompt.replace('患者全病程数据.xlsx', '重复.xlsx\n重复.xlsx')), /重复/);

console.log('insight request parser tests passed');
