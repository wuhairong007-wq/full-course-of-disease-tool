import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { generateFictionalRecords, validateFictionalReview } from './fictional_test_mode.mjs';

const catalog=JSON.parse(await fs.readFile(new URL('../assets/fictional-osteoarthritis-catalog.json',import.meta.url),'utf8'));
const patients=Array.from({length:1498},(_,i)=>({userid:`TEST-${String(i).padStart(5,'0')}`,age:i%3===0?70:50,gender:i%2?'男':'女',disease:'原发性膝骨关节炎',allergyHistory:i%71===0?'磺胺类药物过敏':'无',productName:'硫酸氨基葡萄糖胶囊',productType:'用药'}));
const options={patients,catalog,company:'江苏壹号畅达药业有限公司',minimumMedications:3};
const result=generateFictionalRecords(options);
assert.equal(result.records.length,1498);
assert.equal(result.metrics.distinctDrugCombinations,12);
assert.equal(result.metrics.distinctPrescriptions,24);
assert.deepEqual(result,generateFictionalRecords(options));
assert.deepEqual(result.records.map(r=>r.userid),patients.map(p=>p.userid));
for(const [i,r] of result.records.entries()) {
 assert.equal(new Set(r.combinedMedication).size,3);
 const entries=r.prescriptionList.split(' + ');
 assert.equal(entries.length,3);
 r.combinedMedication.forEach((name,j)=>assert(entries[j].startsWith(name+' ')));
 assert.equal(r.allergyHistory,patients[i].allergyHistory);
 if(patients[i].allergyHistory.includes('磺胺')) assert(!r.combinedMedication.includes('塞来昔布胶囊'));
 if(patients[i].age>=65) assert(entries.slice(1).every(e=>e.includes('疗程3天')));
}
const scaling=[10,50,200,500,1498].map(n=>generateFictionalRecords({...options,patients:patients.slice(0,n)}).metrics.distinctPrescriptions);
assert.deepEqual(scaling,[4,8,15,23,24]);
// All-sulfonamide and small cohorts must remain covered despite catalog limits.
const constrained=patients.slice(0,30).map(p=>({...p,allergyHistory:'磺胺类药物过敏',age:70}));
assert(generateFictionalRecords({...options,patients:constrained}).records.every(r=>!r.combinedMedication.includes('塞来昔布胶囊')));
for(const patch of [{age:17},{disease:'糖尿病'},{allergyHistory:'甲壳类过敏'},{clinicalContext:{妊娠状态:'是'}},{symptomEvidence:{疼痛评分:0}},{productName:'另一药品'}]) {
 assert.throws(()=>generateFictionalRecords({...options,patients:[{...patients[0],...patch}]}));
}
assert.throws(()=>generateFictionalRecords({...options,minimumMedications:4}),/最少种数/);
assert.throws(()=>generateFictionalRecords({...options,company:'山东利赛医药有限公司'}),/最少种数/);
assert.throws(()=>generateFictionalRecords({...options,patients:[patients[0],patients[0]]}),/重复/);
const duplicate=structuredClone(catalog); duplicate.variants.push({...duplicate.variants[0],id:'different-text-only',assumption:'另一种叙述'});
assert.throws(()=>generateFictionalRecords({...options,catalog:duplicate}),/重复.*处方/);
const badSpec=structuredClone(catalog); badSpec.drugs.glucosamine.specification='0.25g/片';
assert.throws(()=>generateFictionalRecords({...options,catalog:badSpec}),/胶囊剂/);
const sameRole=structuredClone(catalog); sameRole.variants[0].medications.push({drug:'naproxen',days:3});
assert.throws(()=>generateFictionalRecords({...options,catalog:sameRole}),/治疗作用/);
// Synthetic catalog mutation tests deduplication after company filtering only.
// The changed product duration is not a researched medical recommendation.
const collapsed=structuredClone(catalog);
const first=structuredClone(collapsed.variants[0]);first.maxAge=64;
const second=structuredClone(first);second.id='equivalent-after-exclusion';second.maxAge=80;second.medications[0].days+=1;
collapsed.variants=[first,second];
const filtered=generateFictionalRecords({...options,catalog:collapsed,company:'山东利赛医药有限公司',minimumMedications:2,patients:[{...patients[1],age:50},{...patients[2],age:70}]});
assert.equal(filtered.records.length,2);
assert.equal(filtered.metrics.distinctPrescriptions,1);
assert.equal(filtered.metrics.largestPrescriptionGroup,2);
const review={kind:'fictional-test-review/v1',sourceSHA256:'a'.repeat(64),company:options.company,minimumMedications:3,catalog,assignments:result.assignments};
const validation={review,patients,records:result.records,sourceSHA256:review.sourceSHA256,company:options.company,minimumMedications:3,output:'患者_虚构测试.xlsx'};
assert.equal(validateFictionalReview(validation).distinctPrescriptions,24);
assert.throws(()=>validateFictionalReview({...validation,output:'/虚构测试/患者.xlsx'}),/文件名/);
assert.throws(()=>validateFictionalReview({...validation,sourceSHA256:'b'.repeat(64)}),/源文件/);
assert.throws(()=>validateFictionalReview({...validation,company:'另一公司'}),/公司/);
const tampered=structuredClone(result.records); tampered[0].prescriptionList=tampered[0].prescriptionList.replace('0.5g','5g');
assert.throws(()=>validateFictionalReview({...validation,records:tampered}),/不一致/);
console.log(JSON.stringify({status:'passed',suite:'fictional test mode',patients:1498,scaling,...result.metrics}));
