import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const skillDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clinicalRules = await fs.readFile(path.join(skillDir, "references", "clinical-rules.md"), "utf8");
const recordSchema = await fs.readFile(path.join(skillDir, "references", "record-schema.md"), "utf8");
const skill = await fs.readFile(path.join(skillDir, "SKILL.md"), "utf8");

assert.match(clinicalRules, /疾病.*治疗作用|治疗作用.*疾病/);
for (const text of [clinicalRules, recordSchema]) {
  assert.match(text, /剂型/);
  assert.match(text, /说明书|已审核药品/);
  assert.match(text, /肌内注射/);
}
assert.match(recordSchema, /disease site.*treatment role/i);
assert.match(skill, /disease site.*treatment role/i);
assert.match(skill, /dosage form/i);
assert.match(skill, /dynamic/i);
assert.match(skill, /肌内注射/);

assert.match(clinicalRules, /气道廓清/);
assert.match(clinicalRules, /雾化吸入/);
assert.match(clinicalRules, /眼科局部用药/);
assert.match(clinicalRules, /局部注射或外用/);
assert.match(clinicalRules, /推理线索/);
assert.match(clinicalRules, /一对一规则/);
assert.match(clinicalRules, /停止.*报告.*患者.*药物.*冲突原因/);
assert.match(clinicalRules, /重新选择候选.*重建规格.*每次用量.*给药途径.*频次.*时机.*疗程.*专项警示/s);
assert.match(recordSchema, /route fit is uncertain.*stop and report.*patient and drug/i);
assert.match(recordSchema, /途径变化.*重新生成|When route judgment changes/s);

for (const text of [clinicalRules, recordSchema]) {
  assert.doesNotMatch(text, /所有[^\n]{0,20}(?:支气管扩张|鼻窦炎|眼科|软组织)[^\n]{0,20}(?:必须|一律|固定)(?:雾化吸入|眼科局部用药|局部注射|外用|肌内注射)/);
  assert.doesNotMatch(text, /(?:支气管扩张|鼻窦炎|眼科|软组织)\s*[=:→]\s*(?:雾化吸入|眼科局部用药|局部注射|外用|肌内注射)/);
}

console.log(JSON.stringify({ status: "passed", cases: 6 }));
