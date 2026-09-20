# Activation Period Time Windows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate medication confirmation and adverse-reaction timestamps from the activation morning/afternoon period, enforce `07:30:00–21:59:59`, reject invalid service-period or cross-month targets, and guarantee adverse-reaction time is later than confirmation time.

**Architecture:** A new pure `activation_time_windows.mjs` module owns parsing, period classification, target-window calculation, stable selection, and cross-event ordering. Stage 3 intersects its target window with the service period; stage 4 rejects target dates outside the activation month. Both builders retain their existing workbook interfaces and templates.

**Tech Stack:** Node.js ES modules, `node:assert/strict`, `@oai/artifact-tool`, Markdown skill contracts, YAML agent metadata.

---

## Execution Isolation

The main worktree currently contains an unrelated deletion of
`docs/superpowers/plans/2026-09-20-medication-confirmation-required-service-period.md`. Preserve it.
Execute this plan in a new git worktree and integrate only the implementation commits. Do not restore, stage, or
commit that deletion.

## File Map

- Create `generating-patient-full-course-data/scripts/activation_time_windows.mjs`: shared activation classification, target-window calculation, formatting, and stable timestamp selection.
- Create `generating-patient-full-course-data/scripts/test_activation_time_windows.mjs`: boundary, ordering, and stability tests for the shared module.
- Modify `generating-patient-full-course-data/scripts/medication_confirmation_time.mjs`: use the shared medication-confirmation window and intersect it with the service period.
- Modify `generating-patient-full-course-data/scripts/test_medication_confirmation_time.mjs`: replace arbitrary-window expectations with morning/afternoon scheduling and service-boundary failures.
- Modify `generating-patient-full-course-data/scripts/test_medication_tracking_workbooks.mjs`: verify generated confirmation dates and no-output failure behavior.
- Modify `generating-patient-full-course-data/scripts/adverse_reaction_time.mjs`: use the shared adverse-reaction window and reject cross-month targets.
- Modify `generating-patient-full-course-data/scripts/test_adverse_reaction_time.mjs`: verify `+1` afternoon, `+2` morning, cross-month failures, and ordering.
- Modify `generating-patient-full-course-data/scripts/test_adverse_reaction_workbook.mjs`: verify workbook occurrence windows and atomic failure.
- Modify `generating-patient-full-course-data/SKILL.md`: document the new deterministic time rules and stop conditions.
- Modify `generating-patient-full-course-data/references/medication-tracking-schema.md`: replace the old arbitrary daytime confirmation window.
- Modify `generating-patient-full-course-data/references/adverse-reaction-schema.md`: replace the old remaining-month occurrence window.
- Modify `generating-patient-full-course-data/agents/openai.yaml`: include the stage-3/stage-4 timing contract in the agent prompt.
- Modify `generating-patient-full-course-data/scripts/validate_skill.mjs`: require the new module/test and updated wording.

### Task 1: Create The Shared Activation Time-Window Module

**Files:**
- Create: `generating-patient-full-course-data/scripts/activation_time_windows.mjs`
- Create: `generating-patient-full-course-data/scripts/test_activation_time_windows.mjs`

- [ ] **Step 1: Write the failing shared-module test**

Create `test_activation_time_windows.mjs`:

```js
import assert from "node:assert/strict";
import {
  getActivationTimeWindow,
  selectStableTimeInWindow,
} from "./activation_time_windows.mjs";

const morningConfirmation = getActivationTimeWindow({
  userid: "U-MORNING",
  activateTime: "2026-09-08 11:59:59",
  eventType: "medication-confirmation",
});
assert.equal(morningConfirmation.period, "morning");
assert.equal(morningConfirmation.startText, "2026-09-08 12:00:00");
assert.equal(morningConfirmation.endText, "2026-09-08 21:59:59");

const afternoonConfirmation = getActivationTimeWindow({
  userid: "U-AFTERNOON",
  activateTime: "2026-09-08 12:00:00",
  eventType: "medication-confirmation",
});
assert.equal(afternoonConfirmation.period, "afternoon");
assert.equal(afternoonConfirmation.startText, "2026-09-09 07:30:00");
assert.equal(afternoonConfirmation.endText, "2026-09-09 11:59:59");

const morningAdverse = getActivationTimeWindow({
  userid: "U-MORNING",
  activateTime: "2026-09-08 11:59:59",
  eventType: "adverse-reaction",
});
assert.equal(morningAdverse.startText, "2026-09-09 12:00:00");
assert.equal(morningAdverse.endText, "2026-09-09 21:59:59");

const afternoonAdverse = getActivationTimeWindow({
  userid: "U-AFTERNOON",
  activateTime: "2026-09-08 12:00:00",
  eventType: "adverse-reaction",
});
assert.equal(afternoonAdverse.startText, "2026-09-10 07:30:00");
assert.equal(afternoonAdverse.endText, "2026-09-10 11:59:59");

assert(morningAdverse.start > morningConfirmation.end);
assert(afternoonAdverse.start > afternoonConfirmation.end);

const first = selectStableTimeInWindow({
  userid: "U-STABLE",
  salt: "medication-confirmation",
  start: morningConfirmation.start,
  end: morningConfirmation.end,
});
const repeated = selectStableTimeInWindow({
  userid: "U-STABLE",
  salt: "medication-confirmation",
  start: morningConfirmation.start,
  end: morningConfirmation.end,
});
assert.equal(first, repeated);
assert(first >= morningConfirmation.start && first <= morningConfirmation.end);

assert.throws(
  () => getActivationTimeWindow({ userid: "U-BAD", activateTime: "bad", eventType: "medication-confirmation" }),
  /U-BAD的激活时间格式无效/,
);
assert.throws(
  () => getActivationTimeWindow({ userid: "U-BAD", activateTime: "2026-09-08 10:00:00", eventType: "unknown" }),
  /不支持的时间事件类型/,
);

console.log(JSON.stringify({ status: "passed", boundaryCases: 4, orderingCases: 2 }));
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
node scripts/test_activation_time_windows.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `activation_time_windows.mjs`.

- [ ] **Step 3: Implement the shared module**

Create the module with this implementation:

```js
const MORNING_END_HOUR = 12;
const MORNING_WINDOW_START_SECONDS = 7 * 3600 + 30 * 60;
const MORNING_WINDOW_END_SECONDS = 11 * 3600 + 59 * 60 + 59;
const AFTERNOON_WINDOW_START_SECONDS = 12 * 3600;
const AFTERNOON_WINDOW_END_SECONDS = 21 * 3600 + 59 * 60 + 59;

export function parseDateTime(value, label) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4})[-\/]([01]?\d)[-\/]([0-3]?\d)(?:[ T]([0-2]?\d):([0-5]\d)(?::([0-5]\d))?)?$/);
  if (!match) throw new Error(`${label}格式无效，应为YYYY-MM-DD HH:mm:ss`);
  const [year, month, day, hour, minute, second] = [
    match[1], match[2], match[3], match[4] ?? "0", match[5] ?? "0", match[6] ?? "0",
  ].map(Number);
  const date = new Date(year, month - 1, day, hour, minute, second);
  if (
    date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day
    || date.getHours() !== hour || date.getMinutes() !== minute || date.getSeconds() !== second
  ) throw new Error(`${label}不是有效时间`);
  return date;
}

export function formatDateTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    + ` ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function stableRandom(userid, salt) {
  let hash = 2166136261;
  for (const character of `${userid}|${salt}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

export function getActivationTimeWindow({ userid, activateTime, eventType }) {
  const activation = parseDateTime(activateTime, `${userid}的激活时间`);
  const period = activation.getHours() < MORNING_END_HOUR ? "morning" : "afternoon";
  const rule = {
    "medication-confirmation": {
      morning: { dayOffset: 0, window: "afternoon" },
      afternoon: { dayOffset: 1, window: "morning" },
    },
    "adverse-reaction": {
      morning: { dayOffset: 1, window: "afternoon" },
      afternoon: { dayOffset: 2, window: "morning" },
    },
  }[eventType]?.[period];
  if (!rule) throw new Error(`不支持的时间事件类型：${eventType}`);
  const targetDate = new Date(activation);
  targetDate.setHours(0, 0, 0, 0);
  targetDate.setDate(targetDate.getDate() + rule.dayOffset);
  const [startSeconds, endSeconds] = rule.window === "morning"
    ? [MORNING_WINDOW_START_SECONDS, MORNING_WINDOW_END_SECONDS]
    : [AFTERNOON_WINDOW_START_SECONDS, AFTERNOON_WINDOW_END_SECONDS];
  const start = new Date(targetDate);
  start.setHours(0, 0, startSeconds, 0);
  const end = new Date(targetDate);
  end.setHours(0, 0, endSeconds, 0);
  return {
    activation,
    period,
    start,
    end,
    startText: formatDateTime(start),
    endText: formatDateTime(end),
  };
}

export function selectStableTimeInWindow({ userid, salt, start, end }) {
  if (start > end) throw new Error(`${userid}的目标时间窗口无合法时间`);
  const totalSeconds = Math.floor((end.getTime() - start.getTime()) / 1000) + 1;
  const selectedSeconds = Math.floor(stableRandom(userid, salt) * totalSeconds);
  return new Date(start.getTime() + selectedSeconds * 1000);
}
```

- [ ] **Step 4: Run the shared-module test and verify GREEN**

Run:

```bash
node scripts/test_activation_time_windows.mjs
```

Expected: PASS with `boundaryCases: 4` and `orderingCases: 2`.

- [ ] **Step 5: Commit the shared module**

```bash
git add generating-patient-full-course-data/scripts/activation_time_windows.mjs \
  generating-patient-full-course-data/scripts/test_activation_time_windows.mjs
git commit -m "feat: add activation-based time windows"
```

### Task 2: Apply Activation Windows To Medication Confirmation Time

**Files:**
- Modify: `generating-patient-full-course-data/scripts/test_medication_confirmation_time.mjs`
- Modify: `generating-patient-full-course-data/scripts/medication_confirmation_time.mjs`
- Modify: `generating-patient-full-course-data/scripts/test_medication_tracking_workbooks.mjs`

- [ ] **Step 1: Replace confirmation tests with explicit morning/afternoon cases**

Add helpers that assert the expected date and clock window:

```js
function assertClockWindow(resultText, expectedDate, minimumSeconds, maximumSeconds) {
  const result = new Date(resultText.replace(" ", "T"));
  assert.equal(resultText.slice(0, 10), expectedDate);
  const seconds = result.getHours() * 3600 + result.getMinutes() * 60 + result.getSeconds();
  assert(seconds >= minimumSeconds && seconds <= maximumSeconds, resultText);
}
```

Use these cases:

```js
const morning = generateMedicationConfirmationTime({
  userid: "U-MORNING",
  activateTime: "2026-09-08 11:59:59",
  serviceStartDate: "2026-09-01",
  serviceEndDate: "2026-09-30",
});
assertClockWindow(morning, "2026-09-08", 12 * 3600, 21 * 3600 + 59 * 60 + 59);

const afternoon = generateMedicationConfirmationTime({
  userid: "U-AFTERNOON",
  activateTime: "2026-09-08 12:00:00",
  serviceStartDate: "2026-09-01",
  serviceEndDate: "2026-09-30",
});
assertClockWindow(afternoon, "2026-09-09", 7 * 3600 + 30 * 60, 11 * 3600 + 59 * 60 + 59);
```

Add service failures:

```js
assert.throws(
  () => generateMedicationConfirmationTime({
    userid: "U-END-BOUNDARY",
    activateTime: "2026-09-29 12:00:00",
    serviceStartDate: "2026-09-01",
    serviceEndDate: "2026-09-30",
  }),
  /U-END-BOUNDARY.*目标确认时段.*服务周期.*2026-09-30/,
);

assert.throws(
  () => generateMedicationConfirmationTime({
    userid: "U-BEFORE-SERVICE",
    activateTime: "2026-08-20 09:00:00",
    serviceStartDate: "2026-09-01",
    serviceEndDate: "2026-09-30",
  }),
  /U-BEFORE-SERVICE.*目标确认时段.*服务周期/,
);
```

Keep stability, strict-after-activation, service-start-inclusive, service-end-exclusive, and 7-day assertions.
Remove tests that expect arbitrary later dates or `07:00:00`.

- [ ] **Step 2: Run the confirmation test and verify RED**

Run:

```bash
node scripts/test_medication_confirmation_time.mjs
```

Expected: FAIL because the old generator can choose dates outside the new target day/window.

- [ ] **Step 3: Replace the old enumeration with the shared target window**

In `medication_confirmation_time.mjs`:

```js
import {
  formatDateTime,
  getActivationTimeWindow,
  parseDateTime,
  selectStableTimeInWindow,
} from "./activation_time_windows.mjs";
```

Calculate and intersect the target window:

```js
const target = getActivationTimeWindow({
  userid: patient.userid,
  activateTime: patient.activateTime,
  eventType: "medication-confirmation",
});
const serviceStart = parseDateTime(patient.serviceStartDate, `${patient.userid}的服务开始日期`);
const serviceEnd = parseDateTime(patient.serviceEndDate, `${patient.userid}的服务结束日期`);
const latestByActivation = target.activation.getTime() + 7 * 24 * 3600 * 1000;
const start = new Date(Math.max(target.start.getTime(), serviceStart.getTime(), target.activation.getTime() + 1000));
const end = new Date(Math.min(target.end.getTime(), serviceEnd.getTime() - 1000, latestByActivation));
if (start > end) {
  throw new Error(
    `${patient.userid}的目标确认时段${target.startText}至${target.endText}`
    + `不在服务周期${patient.serviceStartDate}至${patient.serviceEndDate}内`,
  );
}
const result = selectStableTimeInWindow({
  userid: patient.userid,
  salt: `medication-confirmation-${patient.activateTime}-${patient.serviceStartDate}-${patient.serviceEndDate}`,
  start,
  end,
});
return formatDateTime(result);
```

Delete the old full-day constants, window loop, and local duplicate parser/random/formatter.

- [ ] **Step 4: Strengthen workbook integration assertions**

In `test_medication_tracking_workbooks.mjs`, derive the expected target date/window from each source activation:

```js
const formatLocalDate = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");
const activation = parseDateTime(activationByUserid.get(row[0]));
const confirmation = parseDateTime(row[1]);
if (activation.getHours() < 12) {
  assert.equal(formatLocalDate(confirmation), formatLocalDate(activation));
  assert(secondsOfDay(confirmation) >= 12 * 3600);
} else {
  const expected = new Date(activation);
  expected.setDate(expected.getDate() + 1);
  assert.equal(formatLocalDate(confirmation), formatLocalDate(expected));
  assert(secondsOfDay(confirmation) >= 7 * 3600 + 30 * 60);
  assert(secondsOfDay(confirmation) <= 11 * 3600 + 59 * 60 + 59);
}
```

Change the no-window fixture to an afternoon activation on the day before the exclusive service end. Assert that
the builder exits nonzero, includes the userid, and creates neither output workbook.

- [ ] **Step 5: Run stage-3 tests and verify GREEN**

Run:

```bash
node scripts/test_medication_confirmation_time.mjs
node scripts/test_medication_tracking_workbooks.mjs
```

Expected: both PASS; every confirmation uses only the specified activation-derived window.

- [ ] **Step 6: Commit stage 3**

```bash
git add generating-patient-full-course-data/scripts/medication_confirmation_time.mjs \
  generating-patient-full-course-data/scripts/test_medication_confirmation_time.mjs \
  generating-patient-full-course-data/scripts/test_medication_tracking_workbooks.mjs
git commit -m "fix: schedule confirmation by activation period"
```

### Task 3: Apply Activation Windows To Adverse-Reaction Time

**Files:**
- Modify: `generating-patient-full-course-data/scripts/test_adverse_reaction_time.mjs`
- Modify: `generating-patient-full-course-data/scripts/adverse_reaction_time.mjs`
- Modify: `generating-patient-full-course-data/scripts/test_adverse_reaction_workbook.mjs`

- [ ] **Step 1: Rewrite adverse-time tests for exact day offsets**

Use these core cases:

```js
const morningPatient = { userid: "U-MORNING", activateTime: "2026-09-08 11:59:59" };
const morningResult = generateAdverseReactionTime(morningPatient);
assertClockWindow(morningResult, "2026-09-09", 12 * 3600, 21 * 3600 + 59 * 60 + 59);

const afternoonPatient = { userid: "U-AFTERNOON", activateTime: "2026-09-08 12:00:00" };
const afternoonResult = generateAdverseReactionTime(afternoonPatient);
assertClockWindow(afternoonResult, "2026-09-10", 7 * 3600 + 30 * 60, 11 * 3600 + 59 * 60 + 59);
```

Import `generateMedicationConfirmationTime` and verify the cross-stage invariant:

```js
for (const patient of [morningPatient, afternoonPatient]) {
  const confirmation = generateMedicationConfirmationTime({
    ...patient,
    serviceStartDate: "2026-09-01",
    serviceEndDate: "2026-09-30",
  });
  const occurrence = generateAdverseReactionTime(patient);
  assert(new Date(occurrence.replace(" ", "T")) > new Date(confirmation.replace(" ", "T")));
}
```

Add both cross-month failures:

```js
assert.throws(
  () => generateAdverseReactionTime({ userid: "U-MORNING-MONTH-END", activateTime: "2026-09-30 09:00:00" }),
  /U-MORNING-MONTH-END.*目标发生日期2026-10-01.*跨月/,
);
assert.throws(
  () => generateAdverseReactionTime({ userid: "U-AFTERNOON-MONTH-END", activateTime: "2026-09-29 12:00:00" }),
  /U-AFTERNOON-MONTH-END.*目标发生日期2026-10-01.*跨月/,
);
```

- [ ] **Step 2: Run the adverse-time test and verify RED**

Run:

```bash
node scripts/test_adverse_reaction_time.mjs
```

Expected: FAIL because the old generator can use the activation day and allows other remaining-month dates.

- [ ] **Step 3: Implement the adverse target window and month check**

Replace `adverse_reaction_time.mjs` with shared-module use:

```js
import {
  formatDateTime,
  getActivationTimeWindow,
  selectStableTimeInWindow,
} from "./activation_time_windows.mjs";

export function generateAdverseReactionTime(patient) {
  const target = getActivationTimeWindow({
    userid: patient.userid,
    activateTime: patient.activateTime,
    eventType: "adverse-reaction",
  });
  if (
    target.start.getFullYear() !== target.activation.getFullYear()
    || target.start.getMonth() !== target.activation.getMonth()
  ) {
    throw new Error(
      `${patient.userid}的激活时间${patient.activateTime}对应目标发生日期`
      + `${target.startText.slice(0, 10)}跨月，不符合不良反应发生时间规则`,
    );
  }
  const result = selectStableTimeInWindow({
    userid: patient.userid,
    salt: `adverse-reaction-${patient.activateTime}`,
    start: target.start,
    end: target.end,
  });
  return formatDateTime(result);
}
```

- [ ] **Step 4: Update workbook integration checks and atomic failure**

In `test_adverse_reaction_workbook.mjs`, assert each selected patient uses `+1` afternoon or `+2` morning.
Change the earliest allowed clock from `06:00:00` to `07:30:00`.

Add an isolated selected patient with userid `U-CROSS-MONTH` activated at `2026-09-30 09:00:00`; run the
builder and assert:

```js
assert.notEqual(crossMonthResult.status, 0);
assert.match(`${crossMonthResult.stdout}\n${crossMonthResult.stderr}`, /U-CROSS-MONTH.*目标发生日期2026-10-01.*跨月/);
await assert.rejects(fs.access(crossMonthOutput), { code: "ENOENT" });
```

Ensure the builder computes all output rows before export, so one invalid patient prevents any partial workbook.

- [ ] **Step 5: Run stage-4 and relationship tests**

Run:

```bash
node scripts/test_adverse_reaction_time.mjs
node scripts/test_adverse_reaction_workbook.mjs
```

Expected: both PASS; cross-month cases report the userid and create no output.

- [ ] **Step 6: Commit stage 4**

```bash
git add generating-patient-full-course-data/scripts/adverse_reaction_time.mjs \
  generating-patient-full-course-data/scripts/test_adverse_reaction_time.mjs \
  generating-patient-full-course-data/scripts/test_adverse_reaction_workbook.mjs
git commit -m "fix: schedule adverse events by activation period"
```

### Task 4: Update The Skill Contract And Package Validation

**Files:**
- Modify: `generating-patient-full-course-data/SKILL.md`
- Modify: `generating-patient-full-course-data/references/medication-tracking-schema.md`
- Modify: `generating-patient-full-course-data/references/adverse-reaction-schema.md`
- Modify: `generating-patient-full-course-data/agents/openai.yaml`
- Modify: `generating-patient-full-course-data/scripts/validate_skill.mjs`

- [ ] **Step 1: Add failing package assertions**

Add the new module and test to `requiredFiles`:

```js
"scripts/activation_time_windows.mjs",
"scripts/test_activation_time_windows.mjs",
```

Add contract assertions:

```js
assert.match(skill, /上午激活.*当日下午.*12:00:00.*21:59:59/s);
assert.match(skill, /下午激活.*次日上午.*07:30:00.*11:59:59/s);
assert.match(skill, /上午激活.*\+1天.*下午.*不良反应/s);
assert.match(skill, /下午激活.*\+2天.*上午.*不良反应/s);
assert.match(skill, /跨月.*停止.*userid/s);
assert.match(skill, /不良反应发生时间.*严格晚于.*用药方案确认时间/s);
assert.doesNotMatch(skill, /confirmation times[^\n]*`07:00:00–21:59:59`/);
assert.doesNotMatch(skill, /occurrence times[^\n]*`06:00:00–21:59:59`/);
```

Add matching schema assertions for both target-window rules.

- [ ] **Step 2: Run package validation and verify RED**

Run:

```bash
node scripts/validate_skill.mjs
```

Expected: FAIL because the skill and reference contracts still describe the old arbitrary windows.

- [ ] **Step 3: Update all authoritative documentation**

Make these exact changes:

- Bump `metadata.version` from `1.2.18` to `1.2.19`.
- Stage 3 verification and stop conditions:
  - morning activation -> same-day `12:00:00–21:59:59`;
  - afternoon activation -> next-day `07:30:00–11:59:59`;
  - target must remain inside `[serviceStart, serviceEnd)`;
  - no alternate-day fallback.
- Stage 4 verification and stop conditions:
  - morning activation -> `+1 day` afternoon;
  - afternoon activation -> `+2 days` morning;
  - target date must remain in the activation month;
  - cross-month failure reports userid and produces no workbook.
- State that both rules structurally guarantee adverse-reaction time is later than confirmation time.
- Remove every old `07:00:00–21:59:59`, `06:00:00–21:59:59`, and arbitrary remaining-month description that applies to these fields.
- Add a concise timing-rule sentence to `agents/openai.yaml` without changing trigger syntax.

- [ ] **Step 4: Run package and focused tests**

Run:

```bash
node scripts/validate_skill.mjs
node scripts/test_activation_time_windows.mjs
node scripts/test_medication_confirmation_time.mjs
node scripts/test_medication_tracking_workbooks.mjs
node scripts/test_adverse_reaction_time.mjs
node scripts/test_adverse_reaction_workbook.mjs
```

Expected: all six commands PASS with JSON status lines.

- [ ] **Step 5: Commit the skill contract**

```bash
git add generating-patient-full-course-data/SKILL.md \
  generating-patient-full-course-data/references/medication-tracking-schema.md \
  generating-patient-full-course-data/references/adverse-reaction-schema.md \
  generating-patient-full-course-data/agents/openai.yaml \
  generating-patient-full-course-data/scripts/validate_skill.mjs
git commit -m "docs: define activation-period timing rules"
```

### Task 5: Verify, Integrate, And Deploy The Skill

**Files:**
- Canonical source: `generating-patient-full-course-data/`
- Active installation: `/Users/a11/.codex/skills/generating-patient-full-course-data/`

- [ ] **Step 1: Run fresh worktree verification**

Run from the skill directory:

```bash
node scripts/validate_skill.mjs
node scripts/test_activation_time_windows.mjs
node scripts/test_medication_confirmation_time.mjs
node scripts/test_medication_tracking_workbooks.mjs
node scripts/test_adverse_reaction_time.mjs
node scripts/test_adverse_reaction_workbook.mjs
```

Expected: all PASS with zero failures.

- [ ] **Step 2: Inspect the complete implementation diff**

Run from the repository root:

```bash
git diff --check main...HEAD
git diff --stat main...HEAD
git log --oneline main..HEAD
```

Expected: no whitespace errors; only the planned scripts, tests, skill docs, references, metadata, and validation
files changed.

- [ ] **Step 3: Integrate implementation commits without touching the existing deletion**

Cherry-pick the implementation commits onto `main` while leaving
`docs/superpowers/plans/2026-09-20-medication-confirmation-required-service-period.md` deleted in the working tree.
Before and after each cherry-pick, run `git status --short` and confirm that deletion remains unstaged and no
unrelated path changes.

- [ ] **Step 4: Run fresh verification on main**

Run the same six commands from the canonical package on `main`.

Expected: all PASS; `git status --short` shows only the pre-existing deleted plan file.

- [ ] **Step 5: Deploy the verified canonical package**

Run:

```bash
rsync -a generating-patient-full-course-data/ /Users/a11/.codex/skills/generating-patient-full-course-data/
```

Do not use `--delete`; preserve untracked local files in the installed skill directory.

- [ ] **Step 6: Verify the active installation**

Run from `/Users/a11/.codex/skills/generating-patient-full-course-data/`:

```bash
node scripts/validate_skill.mjs
node scripts/test_activation_time_windows.mjs
node scripts/test_medication_confirmation_time.mjs
node scripts/test_medication_tracking_workbooks.mjs
node scripts/test_adverse_reaction_time.mjs
node scripts/test_adverse_reaction_workbook.mjs
```

Expected: all PASS and the installed `SKILL.md` reports version `1.2.19`.
