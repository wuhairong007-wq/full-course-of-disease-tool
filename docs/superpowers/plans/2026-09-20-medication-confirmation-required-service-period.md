# Medication Confirmation Required Service Period Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make stage 3 require one canonical service period and reject every medication confirmation timestamp on or after the service-period end date before workbook delivery.

**Architecture:** The extractor remains the only command that accepts service-period dates and stores normalized dates in the extracted patient JSON. A focused period module validates that JSON for the builder and final validator; the confirmation-time module owns the timestamp invariant; a new workbook validator independently reopens the final medication list before delivery.

**Tech Stack:** Node.js ES modules, `node:assert/strict`, `@oai/artifact-tool`, Markdown skill contracts, YAML agent metadata.

---

## File Map

- Create `generating-patient-full-course-data/scripts/medication_tracking_period.mjs`: parse and validate the canonical stage-3 service period from extracted patients.
- Create `generating-patient-full-course-data/scripts/test_medication_tracking_period.mjs`: unit coverage for missing, inconsistent, invalid, and reversed periods.
- Modify `generating-patient-full-course-data/scripts/extract_medication_tracking_patients.mjs`: reuse the shared calendar-date parser.
- Modify `generating-patient-full-course-data/scripts/build_medication_tracking_workbooks.mjs`: require `--patients`, derive the period from extracted patients, and stop accepting repeated service-period input.
- Modify `generating-patient-full-course-data/scripts/medication_confirmation_time.mjs`: expose and apply one confirmation-time invariant.
- Modify `generating-patient-full-course-data/scripts/test_medication_confirmation_time.mjs`: add the reported userid and September boundary regression.
- Create `generating-patient-full-course-data/scripts/validate_medication_tracking_workbooks.mjs`: reopen the final medication list and reject invalid confirmation timestamps.
- Modify `generating-patient-full-course-data/scripts/test_medication_tracking_workbooks.mjs`: cover canonical-period flow plus passing and failing final validation.
- Modify `generating-patient-full-course-data/scripts/validate_skill.mjs`: require the new scripts and the required stage-3 request contract.
- Modify `generating-patient-full-course-data/SKILL.md`: make `服务周期：` mandatory, pass dates once, and require final validation.
- Modify `generating-patient-full-course-data/references/medication-tracking-schema.md`: document the single-source period and final validator.
- Modify `generating-patient-full-course-data/agents/openai.yaml`: expose the required service-period input in the default prompt.
- Modify `README.md`: update the supported stage-3 trigger.

### Task 1: Add The Canonical Service-Period Module

**Files:**
- Create: `generating-patient-full-course-data/scripts/medication_tracking_period.mjs`
- Create: `generating-patient-full-course-data/scripts/test_medication_tracking_period.mjs`
- Modify: `generating-patient-full-course-data/scripts/extract_medication_tracking_patients.mjs`

- [ ] **Step 1: Write the failing period-module test**

Create `test_medication_tracking_period.mjs` with these cases:

```js
import assert from "node:assert/strict";
import { parseCalendarDate, readMedicationTrackingPeriod } from "./medication_tracking_period.mjs";

assert.deepEqual(parseCalendarDate("2026-09-01", "服务周期开始日期"), {
  text: "2026-09-01",
  dayNumber: Math.floor(Date.UTC(2026, 8, 1) / 86400000),
});

const patients = [
  { userid: "U001", serviceStartDate: "2026-09-01", serviceEndDate: "2026-09-30" },
  { userid: "U002", serviceStartDate: "2026-09-01", serviceEndDate: "2026-09-30" },
];
assert.deepEqual(readMedicationTrackingPeriod(patients), {
  serviceStartDate: "2026-09-01",
  serviceEndDate: "2026-09-30",
});

assert.throws(() => readMedicationTrackingPeriod([]), /患者中间数据为空/);
assert.throws(
  () => readMedicationTrackingPeriod([{ ...patients[0], serviceEndDate: "2026-10-01" }, patients[1]]),
  /服务周期不一致/,
);
assert.throws(
  () => readMedicationTrackingPeriod([{ ...patients[0], serviceStartDate: "2026-10-01" }]),
  /开始日期不得晚于结束日期/,
);
assert.throws(() => parseCalendarDate("2026-09-31", "服务周期结束日期"), /不是有效日期/);

console.log(JSON.stringify({ status: "passed", cases: 6 }));
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node scripts/test_medication_tracking_period.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `medication_tracking_period.mjs`.

- [ ] **Step 3: Implement the period module**

Create `medication_tracking_period.mjs` with two exports:

```js
const normalize = (value) => String(value ?? "").trim();

export function parseCalendarDate(value, label) {
  const text = normalize(value);
  const match = text.match(/^(\d{4})[-\/]([01]?\d)[-\/]([0-3]?\d)$/);
  if (!match) throw new Error(`${label}格式无效，应为YYYY-MM-DD`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`${label}不是有效日期`);
  }
  return { text, dayNumber: Math.floor(date.getTime() / 86400000) };
}

export function readMedicationTrackingPeriod(patients) {
  if (!Array.isArray(patients) || !patients.length) throw new Error("患者中间数据为空");
  const firstStart = parseCalendarDate(patients[0].serviceStartDate, "服务周期开始日期");
  const firstEnd = parseCalendarDate(patients[0].serviceEndDate, "服务周期结束日期");
  if (firstStart.dayNumber > firstEnd.dayNumber) throw new Error("服务周期开始日期不得晚于结束日期");
  for (const patient of patients) {
    if (patient.serviceStartDate !== firstStart.text || patient.serviceEndDate !== firstEnd.text) {
      throw new Error(`${patient.userid || "未知患者"}的服务周期不一致`);
    }
  }
  return { serviceStartDate: firstStart.text, serviceEndDate: firstEnd.text };
}
```

Import `parseCalendarDate` in `extract_medication_tracking_patients.mjs` and remove its local duplicate.

- [ ] **Step 4: Run the period and extractor tests**

Run:

```bash
node scripts/test_medication_tracking_period.mjs
node scripts/test_medication_tracking_workbooks.mjs
```

Expected: both PASS; the workbook test still uses the old builder interface at this point.

- [ ] **Step 5: Commit the period module**

```bash
git add generating-patient-full-course-data/scripts/medication_tracking_period.mjs \
  generating-patient-full-course-data/scripts/test_medication_tracking_period.mjs \
  generating-patient-full-course-data/scripts/extract_medication_tracking_patients.mjs
git commit -m "refactor: centralize medication service period"
```

### Task 2: Make The Builder Consume The Extracted Period

**Files:**
- Modify: `generating-patient-full-course-data/scripts/test_medication_tracking_workbooks.mjs`
- Modify: `generating-patient-full-course-data/scripts/build_medication_tracking_workbooks.mjs`

- [ ] **Step 1: Change the integration test to the new builder contract**

Replace the repeated service arguments in `buildArgs` with the extracted patients file:

```js
const buildArgs = [
  "--input", sourcePath,
  "--patients", extractedPath,
  "--records", recordsPath,
  "--tracking-template", path.join(skillDir, "assets", "medication-tracking-template.xlsx"),
  "--medication-template", path.join(skillDir, "assets", "medication-list-template.xlsx"),
  "--tracking-output", trackingOutput,
  "--medication-output", medicationOutput,
];
```

Add a mismatch case after the normal build:

```js
const mismatchedPatients = extracted.map((patient, index) => (
  index === 0 ? { ...patient, serviceEndDate: "2026-09-01" } : patient
));
await fs.writeFile(extractedPath, JSON.stringify(mismatchedPatients, null, 2), "utf8");
const mismatchedPeriodResult = run("build_medication_tracking_workbooks.mjs", buildArgs);
assert.notEqual(mismatchedPeriodResult.status, 0);
assert.match(`${mismatchedPeriodResult.stdout}\n${mismatchedPeriodResult.stderr}`, /服务周期不一致/);
await fs.writeFile(extractedPath, JSON.stringify(extracted, null, 2), "utf8");
```

- [ ] **Step 2: Run the integration test and verify RED**

Run:

```bash
node scripts/test_medication_tracking_workbooks.mjs
```

Expected: FAIL with `缺少服务周期参数：--service-start和--service-end` from the builder.

- [ ] **Step 3: Update the builder argument and data flow**

In `build_medication_tracking_workbooks.mjs`:

1. Add `patients` to the required path arguments.
2. Remove the builder requirement for `--service-start` and `--service-end`.
3. Import `readMedicationTrackingPeriod`.
4. Load `args.patients` and verify it is an array.
5. Compare extracted and source userid arrays exactly, including order.
6. Read one canonical period and attach it to source-derived patient objects.

Use this structure after constructing `sourcePatients`:

```js
const extractedPatients = JSON.parse(await fs.readFile(args.patients, "utf8"));
if (!Array.isArray(extractedPatients)) throw new Error("patients文件必须是JSON数组");
const sourceUserids = sourcePatients.map(({ userid }) => userid);
const extractedUserids = extractedPatients.map(({ userid }) => normalize(userid));
if (JSON.stringify(extractedUserids) !== JSON.stringify(sourceUserids)) {
  throw new Error("患者中间数据与源文件userid或顺序不一致");
}
const period = readMedicationTrackingPeriod(extractedPatients);
const patients = sourcePatients.map((patient) => ({ ...patient, ...period }));
```

Keep source workbook fields authoritative; only userid order and the normalized period come from the extracted JSON.

- [ ] **Step 4: Run the integration test and verify GREEN**

Run:

```bash
node scripts/test_medication_tracking_workbooks.mjs
```

Expected: PASS, including the inconsistent-period rejection.

- [ ] **Step 5: Commit the builder contract**

```bash
git add generating-patient-full-course-data/scripts/build_medication_tracking_workbooks.mjs \
  generating-patient-full-course-data/scripts/test_medication_tracking_workbooks.mjs
git commit -m "fix: use extracted medication service period"
```

### Task 3: Enforce One Confirmation-Time Invariant

**Files:**
- Modify: `generating-patient-full-course-data/scripts/medication_confirmation_time.mjs`
- Modify: `generating-patient-full-course-data/scripts/test_medication_confirmation_time.mjs`

- [ ] **Step 1: Add the reported-user regression tests**

Append:

```js
import { assertMedicationConfirmationTime } from "./medication_confirmation_time.mjs";

const reportedPatient = {
  userid: "00BBB0DD237E4920B364DDC5544E6B7C",
  activateTime: "2026-09-29 21:59:58",
  serviceStartDate: "2026-09-01",
  serviceEndDate: "2026-09-30",
};
assert.equal(generateMedicationConfirmationTime(reportedPatient), "2026-09-29 21:59:59");
assert.throws(
  () => assertMedicationConfirmationTime({
    ...reportedPatient,
    confirmationTime: "2026-10-01 08:23:50",
  }),
  /00BBB0DD237E4920B364DDC5544E6B7C.*2026-10-01 08:23:50.*2026-09-01.*2026-09-30/,
);
```

Move the import into the existing top-level import declaration instead of creating a second import statement.

- [ ] **Step 2: Run the unit test and verify RED**

Run:

```bash
node scripts/test_medication_confirmation_time.mjs
```

Expected: FAIL because `assertMedicationConfirmationTime` is not exported.

- [ ] **Step 3: Implement and apply the invariant**

Export a function that parses the four timestamps and throws a userid-specific error unless all constraints hold:

```js
export function assertMedicationConfirmationTime(patient) {
  const activation = parseDateTime(patient.activateTime, `${patient.userid}的激活时间`);
  const serviceStart = parseDateTime(patient.serviceStartDate, `${patient.userid}的服务开始日期`);
  const serviceEnd = parseDateTime(patient.serviceEndDate, `${patient.userid}的服务结束日期`);
  const confirmation = parseDateTime(patient.confirmationTime, `${patient.userid}的用药方案确认时间`);
  const secondsOfDay = confirmation.getHours() * 3600 + confirmation.getMinutes() * 60 + confirmation.getSeconds();
  const valid = confirmation >= serviceStart
    && confirmation < serviceEnd
    && confirmation > activation
    && confirmation.getTime() - activation.getTime() <= CONFIRMATION_WINDOW_MS
    && secondsOfDay >= DAY_START_SECONDS
    && secondsOfDay <= DAY_END_SECONDS;
  if (!valid) {
    throw new Error(
      `${patient.userid}的用药方案确认时间${patient.confirmationTime}不在服务周期`
      + `${patient.serviceStartDate}至${patient.serviceEndDate}及激活后7天合法时间范围内`,
    );
  }
}
```

After formatting the generated result, call this function before returning it.

- [ ] **Step 4: Run confirmation and workbook tests**

Run:

```bash
node scripts/test_medication_confirmation_time.mjs
node scripts/test_medication_tracking_workbooks.mjs
```

Expected: both PASS.

- [ ] **Step 5: Commit the invariant**

```bash
git add generating-patient-full-course-data/scripts/medication_confirmation_time.mjs \
  generating-patient-full-course-data/scripts/test_medication_confirmation_time.mjs
git commit -m "fix: enforce medication confirmation boundaries"
```

### Task 4: Add Independent Final Workbook Validation

**Files:**
- Create: `generating-patient-full-course-data/scripts/validate_medication_tracking_workbooks.mjs`
- Modify: `generating-patient-full-course-data/scripts/test_medication_tracking_workbooks.mjs`

- [ ] **Step 1: Add passing and failing validator cases**

After the normal medication workbook assertions, run the validator:

```js
const validationResult = run("validate_medication_tracking_workbooks.mjs", [
  "--patients", extractedPath,
  "--medication", medicationOutput,
]);
assert.equal(validationResult.status, 0, `${validationResult.stdout}\n${validationResult.stderr}`);
```

Create a one-row workbook for the reported failure:

```js
const reportedPatientsPath = path.join(tempDir, "reported-patients.json");
const reportedMedicationPath = path.join(tempDir, "reported-medication.xlsx");
await fs.writeFile(reportedPatientsPath, JSON.stringify([{
  userid: "00BBB0DD237E4920B364DDC5544E6B7C",
  activateDate: "2026-09-29 21:59:58",
  serviceStartDate: "2026-09-01",
  serviceEndDate: "2026-09-30",
}], null, 2), "utf8");
const reportedWorkbook = Workbook.create();
const reportedSheet = reportedWorkbook.worksheets.add("用药清单");
reportedSheet.getRange("A1:I2").values = [
  ["userid", "用药方案确认时间", "药品名称", "规格", "单次剂量", "用药频率", "用药时间", "疗程天数", "注意事项"],
  ["00BBB0DD237E4920B364DDC5544E6B7C", "2026-10-01 08:23:50", "测试药品", "1mg/片", "1mg", "每日1次", "早餐后", 1, "测试"],
];
await (await SpreadsheetFile.exportXlsx(reportedWorkbook)).save(reportedMedicationPath);
const reportedValidation = run("validate_medication_tracking_workbooks.mjs", [
  "--patients", reportedPatientsPath,
  "--medication", reportedMedicationPath,
]);
assert.notEqual(reportedValidation.status, 0);
assert.match(
  `${reportedValidation.stdout}\n${reportedValidation.stderr}`,
  /00BBB0DD237E4920B364DDC5544E6B7C.*2026-10-01 08:23:50.*2026-09-01.*2026-09-30/,
);
```

- [ ] **Step 2: Run the integration test and verify RED**

Run:

```bash
node scripts/test_medication_tracking_workbooks.mjs
```

Expected: FAIL because `validate_medication_tracking_workbooks.mjs` does not exist.

- [ ] **Step 3: Implement the final validator**

The validator must:

1. Require `--patients` and `--medication`.
2. Read the extracted patient JSON and call `readMedicationTrackingPeriod`.
3. Open the final workbook with `SpreadsheetFile.importXlsx`.
4. Require the exact nine-column medication header.
5. Reject blank or unknown userid values.
6. Call `assertMedicationConfirmationTime` for every row using `activateDate` from the patient JSON.
7. Require every row for a userid to share one confirmation time.
8. Require the workbook's distinct userid set to equal the extracted patient userid set.
9. Print a JSON success line containing patient and medication-row counts.

The core row check should be:

```js
assertMedicationConfirmationTime({
  userid,
  activateTime: patient.activateDate,
  serviceStartDate: period.serviceStartDate,
  serviceEndDate: period.serviceEndDate,
  confirmationTime,
});
```

- [ ] **Step 4: Run the integration test and verify GREEN**

Run:

```bash
node scripts/test_medication_tracking_workbooks.mjs
```

Expected: PASS; the normal workbook validates and the reported October timestamp is rejected.

- [ ] **Step 5: Commit the validator**

```bash
git add generating-patient-full-course-data/scripts/validate_medication_tracking_workbooks.mjs \
  generating-patient-full-course-data/scripts/test_medication_tracking_workbooks.mjs
git commit -m "feat: validate medication confirmation outputs"
```

### Task 5: Make The Required Input And Validation Workflow Authoritative

**Files:**
- Modify: `generating-patient-full-course-data/SKILL.md`
- Modify: `generating-patient-full-course-data/references/medication-tracking-schema.md`
- Modify: `generating-patient-full-course-data/agents/openai.yaml`
- Modify: `generating-patient-full-course-data/scripts/validate_skill.mjs`
- Modify: `README.md`

- [ ] **Step 1: Add failing skill-contract assertions**

In `validate_skill.mjs`, add the two new scripts and their test to `requiredFiles`:

```js
"scripts/medication_tracking_period.mjs",
"scripts/test_medication_tracking_period.mjs",
"scripts/validate_medication_tracking_workbooks.mjs",
```

Replace the stage-3 trigger assertion and add workflow assertions:

```js
assert.match(skill, /生成跟踪提醒和用药清单 依据文件：<source\.xlsx> 服务周期：YYYY-MM-DD 至 YYYY-MM-DD/);
assert.match(skill, /--patients <temp>\/medication-tracking-patients\.json/);
assert.match(skill, /scripts\/validate_medication_tracking_workbooks\.mjs/);
assert.match(metadata, /服务周期：YYYY-MM-DD 至 YYYY-MM-DD/);
```

- [ ] **Step 2: Run skill validation and verify RED**

Run:

```bash
node scripts/validate_skill.mjs
```

Expected: FAIL because the documented trigger and validator workflow have not yet been updated.

- [ ] **Step 3: Update the skill contract and version**

Make these exact contract changes:

- Bump `metadata.version` from `1.2.18` to `1.2.19`.
- Use `服务周期：YYYY-MM-DD 至 YYYY-MM-DD` in the description, route, stop conditions, metadata prompt, and README.
- State that missing, blank, invalid, or reversed service periods stop stage 3 before extraction.
- Keep service dates only on the extractor command.
- Add `--patients <temp>/medication-tracking-patients.json` to the builder command.
- Remove `--service-start` and `--service-end` from the builder command.
- Add this mandatory final command after building:

```bash
<bundled-node> scripts/validate_medication_tracking_workbooks.mjs \
  --patients <temp>/medication-tracking-patients.json \
  --medication <medication-output.xlsx>
```

- State that final delivery is forbidden when this command fails.
- Update `medication-tracking-schema.md` to identify extracted patient JSON as the canonical service-period carrier and the service-end date as exclusive.

- [ ] **Step 4: Run skill and stage-3 verification**

Run:

```bash
node scripts/validate_skill.mjs
node scripts/test_medication_tracking_period.mjs
node scripts/test_medication_confirmation_time.mjs
node scripts/test_medication_tracking_workbooks.mjs
```

Expected: all four commands PASS with JSON status lines and no warnings or failures.

- [ ] **Step 5: Commit the authoritative contract**

```bash
git add README.md \
  generating-patient-full-course-data/SKILL.md \
  generating-patient-full-course-data/references/medication-tracking-schema.md \
  generating-patient-full-course-data/agents/openai.yaml \
  generating-patient-full-course-data/scripts/validate_skill.mjs
git commit -m "docs: require stage 3 service period"
```

### Task 6: Verify And Deploy The Active Skill Copy

**Files:**
- Source: `generating-patient-full-course-data/`
- Deploy to: `/Users/a11/.codex/skills/generating-patient-full-course-data/`

- [ ] **Step 1: Run fresh source verification**

Run from `generating-patient-full-course-data/`:

```bash
node scripts/validate_skill.mjs
node scripts/test_medication_tracking_period.mjs
node scripts/test_medication_confirmation_time.mjs
node scripts/test_medication_tracking_workbooks.mjs
git status --short
```

Expected: all tests PASS; `git status --short` is empty.

- [ ] **Step 2: Sync the verified canonical package to the active skill directory**

Run from the repository root:

```bash
rsync -a generating-patient-full-course-data/ /Users/a11/.codex/skills/generating-patient-full-course-data/
```

Do not use `--delete`; preserve any local files that are not part of the canonical package.

- [ ] **Step 3: Verify the active copy**

Run:

```bash
cd /Users/a11/.codex/skills/generating-patient-full-course-data
node scripts/validate_skill.mjs
node scripts/test_medication_tracking_period.mjs
node scripts/test_medication_confirmation_time.mjs
node scripts/test_medication_tracking_workbooks.mjs
```

Expected: all commands PASS from the installed skill path.

- [ ] **Step 4: Confirm deployed version and boundary text**

Run:

```bash
sed -n 's/^  version: "\(.*\)"/\1/p' /Users/a11/.codex/skills/generating-patient-full-course-data/SKILL.md
rg -n "服务周期：YYYY-MM-DD 至 YYYY-MM-DD|validate_medication_tracking_workbooks" \
  /Users/a11/.codex/skills/generating-patient-full-course-data/SKILL.md
```

Expected: version `1.2.19`, the required trigger, and the final validator command are present.

