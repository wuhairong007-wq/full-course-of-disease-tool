import assert from "node:assert/strict";
import { generateAdverseReactionTime } from "./adverse_reaction_time.mjs";
import { generateMedicationConfirmationTime } from "./medication_confirmation_time.mjs";

const parseDateTime = (value) => new Date(value.replace(" ", "T"));
const secondsOfDay = (date) => date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
const formatLocalDate = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");

function assertClockWindow(resultText, expectedDate, minimumSeconds, maximumSeconds) {
  const result = parseDateTime(resultText);
  assert.equal(formatLocalDate(result), expectedDate, resultText);
  assert(secondsOfDay(result) >= minimumSeconds, resultText);
  assert(secondsOfDay(result) <= maximumSeconds, resultText);
}

const afternoonWindow = [12 * 3600, 21 * 3600 + 59 * 60 + 59];
const morningWindow = [7 * 3600 + 30 * 60, 11 * 3600 + 59 * 60 + 59];
const cases = [
  {
    patient: { userid: "U-MORNING-END", activateTime: "2026-09-08 11:59:59" },
    expectedDate: "2026-09-09",
    window: afternoonWindow,
  },
  {
    patient: { userid: "U-EARLY-MORNING", activateTime: "2026-09-08 02:15:30" },
    expectedDate: "2026-09-09",
    window: afternoonWindow,
  },
  {
    patient: { userid: "U-AFTERNOON-START", activateTime: "2026-09-08 12:00:00" },
    expectedDate: "2026-09-10",
    window: morningWindow,
  },
  {
    patient: { userid: "U-LATE-AFTERNOON", activateTime: "2026-09-08 22:30:00" },
    expectedDate: "2026-09-10",
    window: morningWindow,
  },
  {
    patient: { userid: "U-MORNING-MONTH-EDGE", activateTime: "2026-09-29 09:00:00" },
    expectedDate: "2026-09-30",
    window: afternoonWindow,
  },
  {
    patient: { userid: "U-AFTERNOON-MONTH-EDGE", activateTime: "2026-09-28 15:00:00" },
    expectedDate: "2026-09-30",
    window: morningWindow,
  },
];

for (const { patient, expectedDate, window } of cases) {
  const resultText = generateAdverseReactionTime(patient);
  const result = parseDateTime(resultText);
  assertClockWindow(resultText, expectedDate, window[0], window[1]);
  assert(result > parseDateTime(patient.activateTime), `${patient.userid}发生时间必须严格晚于激活时间`);
  assert.equal(generateAdverseReactionTime(patient), resultText, `${patient.userid}结果不稳定`);
}

for (const patient of [cases[0].patient, cases[2].patient]) {
  const confirmation = generateMedicationConfirmationTime({
    ...patient,
    serviceStartDate: "2026-09-01",
    serviceEndDate: "2026-09-30",
  });
  const occurrence = generateAdverseReactionTime(patient);
  assert(
    parseDateTime(occurrence) > parseDateTime(confirmation),
    `${patient.userid}不良反应发生时间必须晚于用药方案确认时间`,
  );
}

assert.throws(
  () => generateAdverseReactionTime({ userid: "U-MORNING-MONTH-END", activateTime: "2026-09-30 09:00:00" }),
  /U-MORNING-MONTH-END.*目标发生日期2026-10-01.*跨月/,
);
assert.throws(
  () => generateAdverseReactionTime({ userid: "U-AFTERNOON-MONTH-END", activateTime: "2026-09-29 12:00:00" }),
  /U-AFTERNOON-MONTH-END.*目标发生日期2026-10-01.*跨月/,
);

console.log(JSON.stringify({ status: "passed", validCases: cases.length, orderingCases: 2, crossMonthCases: 2 }));
