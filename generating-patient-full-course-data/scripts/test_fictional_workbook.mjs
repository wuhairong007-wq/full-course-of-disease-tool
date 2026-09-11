import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { loadArtifactTool } from './lib/artifact_tool.mjs';

// Entirely synthetic fixtures; test export behavior, not clinical suitability.
const run = promisify(execFile);
const { Workbook, FileBlob, SpreadsheetFile } = await loadArtifactTool();
const root = fileURLToPath(new URL('../', import.meta.url));
const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'fictional-export-'));
const input = path.join(temp, 'source_虚构测试.xlsx');
const output = path.join(temp, '患者明细_虚构测试.xlsx');
const recordsPath = path.join(temp, 'records.json');
const reviewPath = path.join(temp, 'review.json');
const template = path.join(root, 'assets/patient-full-course-template.xlsx');
const headers = ['序号','userid','患者姓名','激活时间','性别','年龄','疾病','手机号码','地区','患者标签','既往过敏史','产品名称','产品类型'];
const rows = Array.from({length: 10}, (_,i) => [i+1,`test-${i}`,'测试','2026-09-01 08:00:00',i%2?'男':'女',i===0?70:40,'原发性膝骨关节炎',null,null,'无',i===1?'磺胺类药物过敏':'无','硫酸氨基葡萄糖胶囊','用药']);
const common = ['--input',input,'--records',recordsPath,'--review',reviewPath,'--company','江苏壹号畅达药业有限公司','--min-medications','3'];
const generation = [path.join(root,'scripts/generate_fictional_test_records.mjs'),...common];
const build = [path.join(root,'scripts/build_workbook.mjs'),...common,'--template',template,'--output',output];
function replace(args,key,value) { const copy=[...args];copy[copy.indexOf(key)+1]=value;return copy; }
try {
  const source = Workbook.create();
  source.worksheets.add('患者').getRange('A1:M11').values=[headers,...rows];
  await (await SpreadsheetFile.exportXlsx(source)).save(input);
  const sourceBytes=await fs.readFile(input), templateBytes=await fs.readFile(template);
  await assert.rejects(run(process.execPath,generation), /显式指定/);
  await run(process.execPath,[...generation,'--mode','fictional-test']);
  const records=JSON.parse(await fs.readFile(recordsPath,'utf8'));
  const review=JSON.parse(await fs.readFile(reviewPath,'utf8'));
  assert.equal(review.metrics.distinctPrescriptions,4);
  await assert.rejects(run(process.execPath,build), /虚构情境记录不能用于真实患者模式/);
  const fictional=[...build,'--mode','fictional-test'];
  await assert.rejects(run(process.execPath,replace(fictional,'--output',path.join(temp,'虚构测试','patients.xlsx'))), /文件名必须含/);
  await assert.rejects(run(process.execPath,replace(fictional,'--output',input)), /不得覆盖/);
  await assert.rejects(run(process.execPath,replace(fictional,'--min-medications','4')), /最少种数不一致/);
  await assert.rejects(fs.access(output));
  const result=await run(process.execPath,fictional);
  const summary=JSON.parse(result.stdout.trim().split('\n').at(-1));
  assert.equal(summary.mode,'fictional-test');
  assert.equal(summary.minimumActualMedications,3);
  const saved=await SpreadsheetFile.importXlsx(await FileBlob.load(output));
  assert.equal(saved.worksheets.items.length,1);
  const sheet=saved.worksheets.getItemAt(0);
  assert.equal(sheet.tables.items.length,1);
  const values=sheet.getUsedRange(true).values;
  assert.deepEqual(values[0],[...headers.slice(0,11),'联合用药','处方清单','手术名称','全病程方案名称','AI状态','确认状态']);
  assert.equal(values.length,rows.length+1);
  values.slice(1).forEach((row,i)=>{
    assert.deepEqual(row.slice(0,11),rows[i].slice(0,11));
    assert.equal(row[11].split('+').length,3);
    assert.deepEqual(row[12].split(' + ').map(entry=>entry.split(' ')[0]),row[11].split('+'));
    assert.deepEqual(row.slice(15),['已生成','待确认']);
    assert.doesNotMatch(row.slice(11).join(' '),/虚构|模拟|由(?:临床)?医生|由医师|未提供/);
    assert(!row[14].includes(rows[i][11]));
  });
  assert(!values[2][11].includes('塞来昔布'));
  const previous=await fs.readFile(output);
  records[0].prescriptionList=records[0].prescriptionList.replace('疗程42天','疗程43天');
  await fs.writeFile(recordsPath,JSON.stringify(records));
  await assert.rejects(run(process.execPath,fictional), /处方记录与虚构情境不一致/);
  assert.deepEqual(await fs.readFile(output),previous);
  await run(process.execPath,[...generation,'--mode','fictional-test']);
  review.sourceSHA256='0'.repeat(64);
  await fs.writeFile(reviewPath,JSON.stringify(review));
  await assert.rejects(run(process.execPath,fictional), /与源文件不一致/);
  assert.deepEqual(await fs.readFile(output),previous);
  assert.deepEqual(await fs.readFile(input),sourceBytes);
  assert.deepEqual(await fs.readFile(template),templateBytes);
  console.log(JSON.stringify({status:'passed',suite:'fictional workbook export',patients:rows.length,distinctPrescriptions:summary.distinctPrescriptions}));
} finally {
  await fs.rm(temp,{recursive:true,force:true});
}
