import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { loadArtifactTool } from './lib/artifact_tool.mjs';
import { generateFictionalRecords } from './fictional_test_mode.mjs';

const args={};
const allowed=new Set(['input','records','review','mode','company','min-medications','catalog']);
for(let i=2;i<process.argv.length;i+=2){
 const key=process.argv[i]?.replace(/^--/,'');const value=process.argv[i+1];
 assert(process.argv[i]?.startsWith('--')&&allowed.has(key)&&value!==undefined,`无效参数：${process.argv[i]}`);
 assert(args[key]===undefined,`重复参数：${key}`);args[key]=value;
}
assert.equal(args.mode,'fictional-test','必须显式指定 --mode fictional-test；最少种数不代表虚构授权');
for(const key of ['input','records','review'])assert(args[key],`缺少参数：--${key}`);
assert(/^[1-5]$/.test(args['min-medications']??'1'),'最少种数必须为1～5的整数');
assert.equal(new Set(['input','records','review'].map(k=>path.resolve(args[k]))).size,3,'源文件、记录和审核文件路径必须不同');
const minimumMedications=Number(args['min-medications']??1);const company=args.company??'';
const catalogPath=args.catalog??fileURLToPath(new URL('../assets/fictional-osteoarthritis-catalog.json',import.meta.url));
const catalog=JSON.parse(await fs.readFile(catalogPath,'utf8'));
const sourceSHA256=crypto.createHash('sha256').update(await fs.readFile(args.input)).digest('hex');
const {FileBlob,SpreadsheetFile}=await loadArtifactTool();
const workbook=await SpreadsheetFile.importXlsx(await FileBlob.load(args.input));
const rows=workbook.worksheets.getItemAt(0).getUsedRange(true).values;
const headers=rows[0].map(h=>String(h??'').trim());
const patients=rows.slice(1).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]])));
const {records,assignments,metrics}=generateFictionalRecords({patients,catalog,company,minimumMedications});
const review={kind:'fictional-test-review/v1',sourceSHA256,company,minimumMedications,catalog,assignments,metrics};
for(const [output,data] of [[args.records,records],[args.review,review]]){
 await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,JSON.stringify(data,null,2)+'\n');
}
console.log(JSON.stringify({status:'passed',mode:args.mode,patients:records.length,minimumMedications,...metrics,records:args.records,review:args.review}));
