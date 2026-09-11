import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import path from 'node:path';
import { validateDrugSpecification } from './drug_specification_validator.mjs';
import { validateGeneratedContent } from './generated_content_validator.mjs';
import { shouldExcludeMedicinalProduct, validateClinicalMedicationSelection } from './clinical_medication_validator.mjs';

const symptomHeaders=['疼痛程度','疼痛评分','炎症表现','症状','症状描述','主诉','症状持续时间','晨僵时间','关节肿胀','活动受限'];
const contextHeaders=['合并疾病','既往病史','当前用药','用药效果','肝功能','肾功能','妊娠状态','哺乳状态','手术史'];
const normalize=x=>String(x??'').trim();
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const nonempty=x=>typeof x==='string' && x.trim().length>0;

export function normalizeFictionalPatient(row) {
 const value=(key,header)=>row[key]??row[header];
 const patient=Object.fromEntries([['userid','userid'],['gender','性别'],['disease','疾病'],['productName','产品名称'],['productType','产品类型'],['allergyHistory','既往过敏史']].map(([key,header])=>[key,normalize(value(key,header))]));
 patient.age=Number(value('age','年龄'));
 patient.allergyHistory ||= '无';
 for(const [key,headers] of [['symptomEvidence',symptomHeaders],['clinicalContext',contextHeaders]]) {
  patient[key]=Object.fromEntries(Object.entries({...Object.fromEntries(headers.filter(h=>row[h]!==undefined).map(h=>[h,row[h]])),...(row[key]??{})}).filter(([,v])=>normalize(v)!=='').map(([k,v])=>[k,normalize(v)]));
 }
 return patient;
}

function prescription(drug,days) {
 return `${drug.name} 规格${drug.specification}；每次用量${drug.dose}；${drug.route}，${drug.frequency}，${drug.timing}；疗程${days}天${drug.durationSuffix??''}；注意：${drug.warnings}`;
}

function semanticKey(medications) {
 // Ignore drug order, punctuation in warnings, scenario descriptions and timing
 // synonyms. Count only differences in medicines and core administration data.
 return JSON.stringify(medications.map(({drug,days})=>[drug.name,drug.specification,drug.dose,drug.route,drug.frequency,days].map(v=>normalize(v).replace(/\s/g,''))).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))));
}

function validateCatalog(catalog) {
 assert.equal(catalog?.kind,'fictional-medication-catalog/v1','虚构方案库格式不正确');
 const {scope,drugs,variants,sources}=catalog;
 assert(nonempty(catalog.id) && /^\d{4}-\d{2}-\d{2}$/.test(catalog.reviewedOn),'方案库缺少编号或核对日期');
 assert(scope && Array.isArray(scope.diseases) && scope.diseases.length && scope.diseases.every(nonempty),'方案库必须列出疾病范围');
 assert(Number.isInteger(scope.minAge)&&Number.isInteger(scope.maxAge)&&scope.minAge>=18&&scope.maxAge>=scope.minAge,'成人虚构方案库年龄范围不正确');
 assert(nonempty(scope.productName)&&scope.productType==='用药','虚构方案库必须声明适用药品');
 assert(Array.isArray(scope.allergyHistories)&&scope.allergyHistories.length,'方案库必须列出已核对的过敏史范围');
 assert(scope.evidenceMatches && typeof scope.evidenceMatches==='object'&&!Array.isArray(scope.evidenceMatches),'方案库必须声明源证据匹配条件');
 assert(nonempty(catalog.planSuffix),'方案库缺少方案名称后缀');
 assert(Array.isArray(catalog.assumptions)&&catalog.assumptions.length&&catalog.assumptions.every(nonempty),'方案库缺少明确的虚构前提');
 assert(Array.isArray(sources)&&sources.length&&sources.every(s=>nonempty(s.name)&&/^https?:\/\//.test(s.url)&&nonempty(s.scope)),'方案库必须包含可追溯的指南及说明书来源');
 assert(drugs && Object.keys(drugs).length && Array.isArray(variants)&&variants.length,'方案库药品和处方不能为空');
 for(const drug of Object.values(drugs)) {
  for(const key of ['name','role','specification','dose','route','frequency','timing','warnings']) assert(nonempty(drug[key]),`药物缺少${key}`);
  assert(Array.isArray(drug.sourceIds)&&drug.sourceIds.length&&drug.sourceIds.every(i=>Number.isInteger(i)&&sources[i]),`${drug.name}缺少说明书依据`);
  const entry=prescription(drug,3);
  validateDrugSpecification({userid:'方案库',medication:drug.name,prescriptionEntry:entry});
  validateGeneratedContent({userid:'方案库',fields:{prescriptionList:entry}});
 }
 const ids=new Set();const semantics=new Set();
 for(const variant of variants) {
  assert(nonempty(variant.id)&&!ids.has(variant.id),'重复或空情境编号');ids.add(variant.id);
  assert(nonempty(variant.assumption),'情境缺少假设依据');
  assert(Number.isInteger(variant.maxAge)&&variant.maxAge>=scope.minAge&&variant.maxAge<=scope.maxAge,'情境年龄上限不正确');
  assert(Array.isArray(variant.excludedAllergies)&&variant.excludedAllergies.every(nonempty),'情境缺少过敏排除规则');
  assert(Array.isArray(variant.medications)&&variant.medications.length>=1&&variant.medications.length<=5,'情境应包含1～5种药品');
  const items=variant.medications.map(item=>{
   assert(drugs[item.drug]&&Number.isInteger(item.days)&&item.days>0,'情境药品或疗程不正确');
   return {drug:drugs[item.drug],days:item.days};
  });
  assert.equal(new Set(items.map(i=>i.drug.name)).size,items.length,'同一情境药品重复');
  assert.equal(new Set(items.map(i=>i.drug.role)).size,items.length,'同一治疗作用不得叠加多个药物');
  const nsaid=items.find(i=>i.drug.role==='口服NSAID');const ppi=items.find(i=>i.drug.role==='PPI');
  if(nsaid&&ppi) assert.equal(nsaid.days,ppi.days,'NSAID与PPI同期疗程不一致');
  if(items.some(i=>i.drug.name==='布洛芬缓释胶囊')) assert(nsaid?.days<=5,'布洛芬短期止痛疗程不得超过5天');
  const semantic=semanticKey(items);
  assert(!semantics.has(semantic),'重复的实质处方不能用不同措辞扩充方案库');semantics.add(semantic);
 }
}

export function generateFictionalRecords({patients,catalog,company='',minimumMedications=1}) {
 assert(Number.isInteger(minimumMedications)&&minimumMedications>=1&&minimumMedications<=5,'最少种数必须为1～5的整数');
 validateCatalog(catalog);
 assert(Array.isArray(patients)&&patients.length,'患者列表不能为空');
 patients=patients.map(normalizeFictionalPatient);
 assert.equal(new Set(patients.map(p=>p.userid)).size,patients.length,'重复userid');
 const scope=catalog.scope;
 for(const p of patients) {
  assert(p.userid, 'userid不能为空');
  assert(Number.isInteger(p.age)&&p.age>=scope.minAge&&p.age<=scope.maxAge,`${p.userid}超出方案库年龄范围`);
  assert(scope.diseases.includes(p.disease)&&p.productName===scope.productName&&p.productType===scope.productType,`${p.userid}疾病或产品不在虚构方案库适用范围`);
  assert(scope.allergyHistories.includes(p.allergyHistory),`${p.userid}过敏史尚未被该方案库核对`);
  assert.deepEqual({...p.symptomEvidence,...p.clinicalContext},scope.evidenceMatches,`${p.userid}存在方案库未覆盖的源临床信息，不能用虚构假设覆盖`);
 }
 const variants=catalog.variants.map(v=>({...v,items:v.medications.map(item=>({drug:catalog.drugs[item.drug],days:item.days}))}));
 function itemsFor(p,v) {return v.items.filter(i=>!(shouldExcludeMedicinalProduct({company,productType:p.productType})&&i.drug.name===p.productName));}
 function eligible(p,v) {
  if(p.age>v.maxAge||v.excludedAllergies.some(a=>p.allergyHistory.includes(a))) return false;
  const meds=itemsFor(p,v).map(i=>i.drug.name);
  if(meds.length<minimumMedications) return false;
  // Chinese celecoxib labeling expressly contraindicates sulfonamide allergy.
  if(p.allergyHistory.includes('磺胺')&&meds.includes('塞来昔布胶囊'))return false;
  try {validateClinicalMedicationSelection({...p,company,medications:meds});return true;}catch{return false;}
 }
 const eligibleById=new Map(patients.map(p=>[p.userid,variants.filter(v=>eligible(p,v))]));
 for(const p of patients)assert(eligibleById.get(p.userid).length,`${p.userid}没有满足过敏、适用范围及最少种数${minimumMedications}的虚构方案`);
 const available=variants.filter(v=>patients.some(p=>eligibleById.get(p.userid).includes(v)));
 // Company filtering can make formerly different variants semantically equal.
 const semanticKeys=new Map(available.map(v=>[v,semanticKey(itemsFor(patients[0],v))]));
 const keyFor=v=>semanticKeys.get(v);
 const distinct=[...new Set(available.map(keyFor))];
 const target=Math.min(distinct.length,Math.ceil(Math.sqrt(patients.length)));
 const activeKeys=new Set(distinct.slice(0,target));
 // Cover restrictive patients even when a small cohort's initial prefix does
 // not include their options. Coverage takes priority over the soft target.
 // Keep all eligibility variants of each semantic prescription: selecting
 // only its first representative could discard an older patient's option.
 for(const p of patients) {
  const eligibleVariants=eligibleById.get(p.userid);
  if(!eligibleVariants.some(v=>activeKeys.has(keyFor(v)))) activeKeys.add(keyFor(eligibleVariants[0]));
 }
 const choices=p=>eligibleById.get(p.userid).filter(v=>activeKeys.has(keyFor(v)));
 const globalUse=new Map();const diseaseUse=new Map();const assigned=new Map();
 const ordered=[...patients].sort((a,b)=>choices(a).length-choices(b).length||hash(a.userid).localeCompare(hash(b.userid)));
 for(const p of ordered){
  const selected=choices(p).sort((a,b)=>(diseaseUse.get(p.disease+a.id)||0)-(diseaseUse.get(p.disease+b.id)||0)||(globalUse.get(a.id)||0)-(globalUse.get(b.id)||0)||hash(p.userid+a.id).localeCompare(hash(p.userid+b.id)))[0];
  assigned.set(p.userid,selected);globalUse.set(selected.id,(globalUse.get(selected.id)||0)+1);diseaseUse.set(p.disease+selected.id,(diseaseUse.get(p.disease+selected.id)||0)+1);
 }
 const records=patients.map(p=>{
  const selected=assigned.get(p.userid);const items=itemsFor(p,selected);
  const record={userid:p.userid,allergyHistory:p.allergyHistory,combinedMedication:items.map(i=>i.drug.name),prescriptionList:items.map(i=>prescription(i.drug,i.days)).join(' + '),surgeryName:'',coursePlanName:p.disease+catalog.planSuffix};
  assert(!record.combinedMedication.some(m=>record.coursePlanName.includes(m)),'方案名称不得包含产品名称');
  validateGeneratedContent({userid:p.userid,fields:{prescriptionList:record.prescriptionList,coursePlanName:record.coursePlanName}});
  return record;
 });
 const assignments=patients.map(p=>({userid:p.userid,scenarioId:assigned.get(p.userid).id}));
 const prescriptionUse=new Map();
 for(const p of patients){const key=keyFor(assigned.get(p.userid));prescriptionUse.set(key,(prescriptionUse.get(key)||0)+1);}
 const metrics={targetDistinctPrescriptions:target,availableDistinctPrescriptions:distinct.length,distinctDrugCombinations:new Set(records.map(r=>r.combinedMedication.slice().sort().join('+'))).size,distinctPrescriptions:prescriptionUse.size,distinctPrescriptionTexts:new Set(records.map(r=>r.prescriptionList)).size,largestPrescriptionGroup:Math.max(...prescriptionUse.values())};
 return {records,assignments,metrics};
}

export function validateFictionalReview({review,patients,records,sourceSHA256,company='',minimumMedications,output}) {
 assert.equal(review?.kind,'fictional-test-review/v1','虚构模式需要专用情境记录，不能冒充真实用药审核');
 assert(path.basename(output).includes('虚构测试'),'虚构输出文件名必须含“虚构测试”');
 assert.equal(review.sourceSHA256,sourceSHA256,'虚构情境记录与源文件不一致');
 assert.equal(review.company,company,'虚构情境记录与公司不一致');
 assert.equal(review.minimumMedications,minimumMedications,'虚构情境记录与最少种数不一致');
 const generated=generateFictionalRecords({patients,catalog:review.catalog,company,minimumMedications});
 assert.deepEqual(review.assignments,generated.assignments,'情境分配不一致');
 assert.deepEqual(records,generated.records,'处方记录与虚构情境不一致');
 return generated.metrics;
}
