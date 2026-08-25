# 用药方案确认时间排除服务结束日实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 保证阶段 3 的用药方案确认时间严格早于服务周期结束日，并在患者激活日期等于服务结束日期时停止生成并提示修改激活日期。

**Architecture:** 让 `medication_confirmation_time.mjs` 负责确认时间合法窗口，将服务结束日期作为排他上界；提取器负责尽早拒绝结束日激活患者；构建器重复边界校验并把服务结束日期传给时间生成器，防止绕过提取器。文档和技能校验同步记录新契约。

**Tech Stack:** Node.js ES modules、`node:assert/strict`、`@oai/artifact-tool`、Markdown 技能规范。

---

### Task 1: 限制确认时间生成窗口

**Files:**
- Modify: `generating-patient-full-course-data/scripts/test_medication_confirmation_time.mjs`
- Modify: `generating-patient-full-course-data/scripts/medication_confirmation_time.mjs`

- [ ] **Step 1: 写入失败的时间边界测试**

把每个成功用例改为传入 `serviceEndDate`，并断言结果早于结束日零点：

```js
const resultText = generateMedicationConfirmationTime({ userid, activateTime: activationText, serviceEndDate: "2026-07-31" });
const serviceEnd = new Date("2026-07-31T00:00:00");
assert(result < serviceEnd, `${userid}确认时间不得落在服务周期最后一天`);
```

增加结束日前一日最后一秒和结束日激活两个边界：

```js
assert.equal(
  generateMedicationConfirmationTime({ userid: "U-LAST-SECOND", activateTime: "2026-07-30 21:59:58", serviceEndDate: "2026-07-31" }),
  "2026-07-30 21:59:59",
);
assert.throws(
  () => generateMedicationConfirmationTime({ userid: "U-SERVICE-END", activateTime: "2026-07-31 10:00:00", serviceEndDate: "2026-07-31" }),
  /激活日期不能为服务周期最后一天，请修改激活日期/,
);
```

- [ ] **Step 2: 运行单元测试确认 RED**

Run:

```bash
CODEX_NODE_MODULES=/Users/a11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/a11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node generating-patient-full-course-data/scripts/test_medication_confirmation_time.mjs
```

Expected: FAIL，因为生成函数尚未接收 `serviceEndDate`，结果仍可能落在服务结束日。

- [ ] **Step 3: 实现排他结束日窗口**

在 `generateMedicationConfirmationTime` 中解析 `serviceEndDate`，先拒绝结束日激活，再把可枚举日期上界限制为激活月份月底与服务结束日前一日中的较早者：

```js
const serviceEnd = parseDateTime(patient.serviceEndDate, `${patient.userid}的服务结束日期`);
if (
  activation.getFullYear() === serviceEnd.getFullYear()
  && activation.getMonth() === serviceEnd.getMonth()
  && activation.getDate() === serviceEnd.getDate()
) {
  throw new Error(`${patient.userid}的激活日期不能为服务周期最后一天，请修改激活日期`);
}
const monthEndExclusive = new Date(year, month + 1, 1);
const confirmationEndExclusive = serviceEnd < monthEndExclusive ? serviceEnd : monthEndExclusive;
```

循环只枚举 `date < confirmationEndExclusive` 的日间秒数；没有窗口时报告确认时间无法在服务结束日前生成。

- [ ] **Step 4: 运行单元测试确认 GREEN**

Run: 同 Step 2。

Expected: `{"status":"passed",...}`。

- [ ] **Step 5: 提交时间生成器改动**

```bash
git add generating-patient-full-course-data/scripts/medication_confirmation_time.mjs generating-patient-full-course-data/scripts/test_medication_confirmation_time.mjs
git commit -m "Bound confirmation time before service end"
```

### Task 2: 在提取和构建入口拒绝结束日激活

**Files:**
- Modify: `generating-patient-full-course-data/scripts/test_medication_tracking_workbooks.mjs`
- Modify: `generating-patient-full-course-data/scripts/extract_medication_tracking_patients.mjs`
- Modify: `generating-patient-full-course-data/scripts/build_medication_tracking_workbooks.mjs`

- [ ] **Step 1: 写入失败的工作流回归测试**

把正常服务周期改为 `2026-08-01` 至 `2026-08-31`，断言所有确认时间早于 `2026-08-31T00:00:00`。另外创建激活时间为 `2026-08-31 10:00:00` 的输入，分别运行提取器和构建器，断言两者包含：

```js
/U001的激活日期不能为服务周期最后一天，请修改激活日期/
```

构建器用例直接写 records 并调用构建脚本，证明不能绕过提取器。

- [ ] **Step 2: 运行工作流测试确认 RED**

Run:

```bash
CODEX_NODE_MODULES=/Users/a11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/a11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node generating-patient-full-course-data/scripts/test_medication_tracking_workbooks.mjs
```

Expected: FAIL，因为提取器尚不拒绝结束日激活，构建器也未把结束日期传给生成器。

- [ ] **Step 3: 实现提取器提前校验**

让 `parseCalendarDate` 返回规范日期和日序号；解析患者激活日期后比较：

```js
if (activateDate.dayNumber === serviceEndDate.dayNumber) {
  throw new Error(`${userid}的激活日期不能为服务周期最后一天，请修改激活日期`);
}
```

患者 JSON 中继续写入原始规范化的 `activateDate.text`。

- [ ] **Step 4: 实现构建器防绕过校验**

读取患者行时解析激活日期；若日序号等于服务结束日则抛出相同错误。生成确认时间时传入：

```js
generateMedicationConfirmationTime({
  userid: patient.userid,
  activateTime: patient.activateDate,
  serviceEndDate: patient.serviceEndDate,
});
```

- [ ] **Step 5: 运行工作流测试确认 GREEN**

Run: 同 Step 2。

Expected: `{"status":"passed","patients":2,...}`。

- [ ] **Step 6: 提交入口校验改动**

```bash
git add generating-patient-full-course-data/scripts/extract_medication_tracking_patients.mjs generating-patient-full-course-data/scripts/build_medication_tracking_workbooks.mjs generating-patient-full-course-data/scripts/test_medication_tracking_workbooks.mjs
git commit -m "Reject activation on service end date"
```

### Task 3: 更新技能契约并完成验证

**Files:**
- Modify: `generating-patient-full-course-data/SKILL.md`
- Modify: `generating-patient-full-course-data/references/medication-tracking-schema.md`
- Modify: `generating-patient-full-course-data/scripts/validate_skill.mjs`

- [ ] **Step 1: 先增加失败的技能契约断言**

在 `validate_skill.mjs` 中要求 schema 明确包含：

```js
assert.match(medicationSchema, /confirmation timestamp.*strictly earlier than the service-period end date/s);
assert.match(medicationSchema, /activation date equals the service-period end date.*stop.*修改激活日期/s);
```

- [ ] **Step 2: 运行技能校验确认 RED**

Run:

```bash
CODEX_NODE_MODULES=/Users/a11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/a11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node generating-patient-full-course-data/scripts/validate_skill.mjs
```

Expected: FAIL，因为文档尚未包含新契约。

- [ ] **Step 3: 更新 SKILL.md 和 schema**

在阶段 3 验证项和停止条件中加入：确认时间不得位于服务周期最后一天；激活日期等于服务结束日期时停止并提示修改。schema 同步说明结束日期是排他上界，不静默过滤患者。

- [ ] **Step 4: 运行技能校验和全部相关测试**

Run:

```bash
CODEX_NODE_MODULES=/Users/a11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/a11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node generating-patient-full-course-data/scripts/test_medication_confirmation_time.mjs
CODEX_NODE_MODULES=/Users/a11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/a11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node generating-patient-full-course-data/scripts/test_medication_tracking_workbooks.mjs
CODEX_NODE_MODULES=/Users/a11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules /Users/a11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node generating-patient-full-course-data/scripts/validate_skill.mjs
git diff --check
```

Expected: 所有命令退出码为 0；两项测试输出 `status: passed`，技能校验输出 `status: passed`，`git diff --check` 无输出。

- [ ] **Step 5: 同步开发副本并复核差异**

把上述技能文件的相同改动同步到工作区同级开发副本 `../generating-patient-full-course-data/`，运行对应 Node 语法检查，并用 `diff` 确认本次规则相关段落一致；不要覆盖两个副本中既有的其他差异。

- [ ] **Step 6: 提交技能文档与校验**

```bash
git add generating-patient-full-course-data/SKILL.md generating-patient-full-course-data/references/medication-tracking-schema.md generating-patient-full-course-data/scripts/validate_skill.mjs
git commit -m "Document service-end confirmation boundary"
```
