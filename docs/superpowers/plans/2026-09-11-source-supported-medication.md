# 基于真实依据充分评估联合用药 Implementation Plan

**Goal:** 读取真实症状，支持有适应证的三至五药结果，禁止随机补病情和凑药。

**Architecture:** 提取器增加可选 symptomEvidence 对象；SKILL.md、临床规则及记录契约共同说明评估顺序和内部复核数据。生成器仍使用现有六键 records 与工作簿校验器。

**Tech Stack:** Node.js、@oai/artifact-tool、Markdown。

- [x] 新增 scripts/test_extract_patients.mjs，使用临时 XLSX 通过实际 CLI 检查症状、零分、否定值和空字段；先运行，确认现有提取器丢失 symptomEvidence。
- [x] 在 scripts/extract_patients.mjs 加入可选列提取：仅当 value 非 null/undefined 且 trim 后不为空时保留，不推断症状。
- [x] 更新 SKILL.md 至 1.1.15，去掉普通患者入口的随机分层路径；更新 references/clinical-rules.md 和 references/record-schema.md，列出可选列及按角色评估、无最低凑药数量的约束。
- [x] 将新测试列入 scripts/validate_skill.mjs 的打包文件清单。
- [x] 运行新集成测试、test_build_workbook.mjs、test_clinical_medication_validator.mjs、test_drug_specification_validator.mjs、test_equivalent_medication_selector.mjs、test_generated_content_validator.mjs、test_route_judgment_rules.mjs、validate_skill.mjs，并检查 diff。
- [x] 备份本机已安装的受影响文件，同步改动，逐文件比较并核对版本。

验证结果：提取 CLI 四场景通过；阶段一工作簿回归通过；临床用药、规格、等效选择、文案、途径及打包检查通过；quick_validate 通过。本机七个受影响文件已备份、同步并逐字节验证一致。
