import assert from "node:assert/strict";
import { validateGeneratedContent } from "./generated_content_validator.mjs";

assert.doesNotThrow(() => validateGeneratedContent({
  userid: "U001",
  fields: {
    aiMedicalRecord: "就诊科室：心血管内科\n就诊日期：2026年8月1日\n处置：围绕已审核疾病和用药方案进行随访。",
    nested: [{ remarks: "出现持续胸痛或晕厥时立即就医。" }],
    surgeryName: "",
  },
}));

for (const [field, text] of [
  ["aiMedicalRecord", "主诉：源文件未提供"],
  ["aiMedicalRecord", "体征：未提供"],
  ["medicationPlan", "未获取相关资料，需医生确认"],
  ["remarks", "暂无资料"],
  ["treatmentPlan", "源文件记录慢性胃炎"],
  ["aiMedicalRecord", "原表没有该字段"],
  ["aiMedicalRecord", "相关情况不详"],
  ["medicationPlan", "缺少相关信息"],
  ["remarks", "无法获取检查结果"],
  ["treatmentPlan", "输入表格中没有记录"],
]) {
  assert.throws(
    () => validateGeneratedContent({ userid: "U001", fields: { [field]: text } }),
    new RegExp(`U001.*${field}.*占位文案`),
  );
}

console.log(JSON.stringify({ status: "passed" }));
