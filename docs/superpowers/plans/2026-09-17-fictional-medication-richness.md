# 模拟用药丰富性实施计划

**Goal:** 获准模拟的阶段1默认至少3药，按记录数验证实质处方目标，文件名标记模拟。

**Architecture:** 沿用方案库、情境记录和导出复核链路；在 fictional_test_mode.mjs 中执行最终药品过滤与可达处方数量校验，生成器/导出器共享默认值。真实模式不变。

**Tech Stack:** Node.js、node:assert、artifact-tool、Markdown。

- [x] 修改 scripts/test_fictional_test_mode.mjs：默认下限3；1498条/24种库报缺口15；仅用于算法测试的合成库达到39；验证受限分配及排序/文字不能充数。运行 node scripts/test_fictional_test_mode.mjs，先观察目标失败。
- [x] 修改 scripts/fictional_test_mode.mjs、scripts/generate_fictional_test_records.mjs、scripts/build_workbook.mjs：共享模拟默认下限3；目标不封顶；匹配患者与不同实质处方后均衡剩余记录；不足拒绝导出；接受模拟文件名。
- [x] 修改 scripts/test_fictional_workbook.mjs：省略最低种数时生成器与导出器一致，输出模拟文件名，表内无模拟说明。执行该测试及真实模式导出回归。
- [x] 更新 SKILL.md、references/fictional-test-mode.md、agents/openai.yaml 和版本1.2.9，明确自然语言授权、扩充库流程与交付统计。
- [x] 执行 node scripts/validate_skill.mjs、技能 quick_validate.py 和受影响测试；检查 diff；仅同步修改的技能文件至已安装目录并核对字节一致。

验证结果：模拟模式回归、10人实际Excel导出、真实模式17列回归、review export 4个用例、validate_skill 71项文件检查和quick_validate均通过；独立复核无阻断问题。1498条算法fixture达到39种，正式24种库在此规模被正确拒绝。已同步9个修改的技能文件并核对SHA256一致；另同步仓库已有的validate_skill.mjs，修复安装副本旧校验器与现行七天确认规则不一致的问题。其他阶段脚本未覆盖。
