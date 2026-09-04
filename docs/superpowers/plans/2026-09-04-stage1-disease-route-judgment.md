# 阶段1疾病适配给药途径实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** 让患者明细生成在药品剂型允许范围内，根据疾病部位与治疗目标动态判断给药途径，避免无依据地默认肌内注射。

**Architecture:** 将“临床适配判断”写入阶段1规则和记录契约，将“剂型允许途径”保留在确定性校验中；校验器只拒绝明显冲突或不合法处方，不把疾病硬编码成唯一途径。通过文本规则回归测试和处方构建测试验证规则可发现、结构不回退。

**Tech Stack:** Markdown skill references, Node.js ESM assertion tests, `@oai/artifact-tool` workbook builder.

---

### Task 1: 更新阶段1临床规则与记录契约

**Files:**
- Modify: `generating-patient-full-course-data/references/clinical-rules.md`
- Modify: `generating-patient-full-course-data/references/record-schema.md`
- Modify: `generating-patient-full-course-data/SKILL.md`
- Test: `generating-patient-full-course-data/scripts/validate_skill.mjs`

- [ ] **Step 1: 写入动态判断规则**

增加明确要求：先识别治疗作用和疾病解剖部位，再结合药品说明书/审核数据允许途径、剂型、年龄、过敏史和治疗场景判断；图片示例只作线索；不得以疾病名称直接映射单一途径；不确定时停止并报告。

- [ ] **Step 2: 强调整条处方重建**

在记录契约中要求途径变化必须同步重建规格、剂量、频次、时机、疗程和警示，且最终处方中的途径必须同时满足治疗目标适配和剂型允许性。

- [ ] **Step 3: 扩展技能自检断言**

在 `validate_skill.mjs` 中断言上述规则存在，包括“动态判断”“不得固定映射”“治疗目标/疾病部位”“不确定时停止”和“整条处方参数重建”等关键词。

- [ ] **Step 4: 运行规则自检**

运行：

```bash
CODEX_NODE_MODULES=/Users/a11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
/Users/a11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
generating-patient-full-course-data/scripts/validate_skill.mjs
```

预期：输出 `status: passed`。

### Task 2: 增加给药途径动态判断回归测试

**Files:**
- Create: `generating-patient-full-course-data/scripts/test_route_judgment_rules.mjs`
- Modify: `generating-patient-full-course-data/scripts/validate_skill.mjs`

- [ ] **Step 1: 写入测试夹具**

测试读取三份规则文件并断言：气道疾病示例要求 AI 评估雾化吸入可能性但不写死；眼科与软组织示例同样是治疗目标线索；系统性治疗仍需按适应证判断；不允许“默认肌内注射”。

- [ ] **Step 2: 写入反硬编码断言**

断言规则文件不包含 `疾病=给药途径` 的固定映射表或“所有支气管扩张均雾化吸入”等绝对化表述，同时包含剂型/说明书优先校验。

- [ ] **Step 3: 运行测试并纳入技能自检**

运行该测试并将脚本路径加入 `validate_skill.mjs` 的必需文件列表及执行断言。

### Task 3: 版本、同步与验证

**Files:**
- Modify: `generating-patient-full-course-data/SKILL.md`
- Sync: `/Users/a11/.codex/skills/generating-patient-full-course-data/`

- [ ] **Step 1: 将版本从 `1.1.5` 升为 `1.1.6`**

仅在规则/测试变更完成后更新语义化版本。

- [ ] **Step 2: 同步活动技能副本**

将仓库中的技能目录同步到 `/Users/a11/.codex/skills/generating-patient-full-course-data/`，不覆盖用户未跟踪设计文档。

- [ ] **Step 3: 运行阶段1相关测试**

运行 `test_clinical_medication_validator.mjs`、`test_drug_specification_validator.mjs`、`test_build_workbook.mjs`、`test_route_judgment_rules.mjs` 和 `validate_skill.mjs`；全部通过后检查 `git diff`，确认只包含本次规则、测试、版本和设计/计划文件。

- [ ] **Step 4: 提交当前分支**

```bash
git add generating-patient-full-course-data/SKILL.md \
  generating-patient-full-course-data/references/clinical-rules.md \
  generating-patient-full-course-data/references/record-schema.md \
  generating-patient-full-course-data/scripts/test_route_judgment_rules.mjs \
  generating-patient-full-course-data/scripts/validate_skill.mjs
git commit -m "fix: require AI disease-aware route judgment"
```
