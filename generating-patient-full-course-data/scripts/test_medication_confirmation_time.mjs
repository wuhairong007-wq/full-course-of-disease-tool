import assert from "node:assert/strict";
import { generateMedicationConfirmationTime } from "./medication_confirmation_time.mjs";

const parseDateTime = (value) => new Date(value.replace(" ", "T"));
const secondsOfDay = (date) => date.getHours() * 3600 + date.getMinutes() * 60 + date.getSeconds();
const formatLocalDate = (date) => [
  date.getFullYear(),
  String(date.getMonth() + 1).padStart(2, "0"),
  String(date.getDate()).padStart(2, "0"),
].join("-");

function assertValidResult({ userid, activateTime, serviceStartDate, serviceEndDate, expectedDate, expectedWindow }) {
  const patient = { userid, activateTime, serviceStartDate, serviceEndDate };
  const resultText = generateMedicationConfirmationTime(patient);
  const result = parseDateTime(resultText);
  const activation = parseDateTime(activateTime);
  const serviceStart = parseDateTime(`${serviceStartDate} 00:00:00`);
  const serviceEnd = parseDateTime(`${serviceEndDate} 00:00:00`);
  assert.equal(formatLocalDate(result), expectedDate, `${userid}目标日期错误：${resultText}`);
  assert(secondsOfDay(result) >= expectedWindow[0], `${userid}早于目标时段：${resultText}`);
  assert(secondsOfDay(result) <= expectedWindow[1], `${userid}晚于目标时段：${resultText}`);
  assert(result > activation, `${userid}确认时间必须严格晚于激活时间`);
  assert(result - activation <= 7 * 24 * 3600 * 1000, `${userid}确认时间必须在激活后7天内`);
  assert(result >= serviceStart, `${userid}确认时间不得早于服务周期开始日期`);
  assert(result < serviceEnd, `${userid}确认时间不得落在服务周期最后一天`);
  assert.equal(generateMedicationConfirmationTime(patient), resultText, `${userid}结果不稳定`);
  return resultText;
}

const afternoonWindow = [12 * 3600, 21 * 3600 + 59 * 60 + 59];
const morningWindow = [7 * 3600 + 30 * 60, 11 * 3600 + 59 * 60 + 59];

assertValidResult({
  userid: "U-MORNING-END",
  activateTime: "2026-09-08 11:59:59",
  serviceStartDate: "2026-09-01",
  serviceEndDate: "2026-09-30",
  expectedDate: "2026-09-08",
  expectedWindow: afternoonWindow,
});
assertValidResult({
  userid: "U-EARLY-MORNING",
  activateTime: "2026-09-08 02:15:30",
  serviceStartDate: "2026-09-01",
  serviceEndDate: "2026-09-30",
  expectedDate: "2026-09-08",
  expectedWindow: afternoonWindow,
});
assertValidResult({
  userid: "U-AFTERNOON-START",
  activateTime: "2026-09-08 12:00:00",
  serviceStartDate: "2026-09-01",
  serviceEndDate: "2026-09-30",
  expectedDate: "2026-09-09",
  expectedWindow: morningWindow,
});
assertValidResult({
  userid: "U-LATE-AFTERNOON",
  activateTime: "2026-09-08 23:30:00",
  serviceStartDate: "2026-09-01",
  serviceEndDate: "2026-09-30",
  expectedDate: "2026-09-09",
  expectedWindow: morningWindow,
});
assertValidResult({
  userid: "U-SERVICE-START",
  activateTime: "2026-08-31 16:00:00",
  serviceStartDate: "2026-09-01",
  serviceEndDate: "2026-09-30",
  expectedDate: "2026-09-01",
  expectedWindow: morningWindow,
});
assertValidResult({
  userid: "U-CROSS-YEAR",
  activateTime: "2026-12-31 16:00:00",
  serviceStartDate: "2026-12-01",
  serviceEndDate: "2027-01-31",
  expectedDate: "2027-01-01",
  expectedWindow: morningWindow,
});

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
assert.throws(
  () => generateMedicationConfirmationTime({
    userid: "U-SERVICE-END",
    activateTime: "2026-09-30 10:00:00",
    serviceStartDate: "2026-09-01",
    serviceEndDate: "2026-09-30",
  }),
  /U-SERVICE-END的激活日期不能为服务周期最后一天，请修改激活日期/,
);

for (let index = 0; index < 1000; index += 1) {
  const result = assertValidResult({
    userid: `U-SAMPLE-${index}`,
    activateTime: index % 2 === 0 ? "2026-09-08 09:00:00" : "2026-09-08 15:00:00",
    serviceStartDate: "2026-09-01",
    serviceEndDate: "2026-09-30",
    expectedDate: index % 2 === 0 ? "2026-09-08" : "2026-09-09",
    expectedWindow: index % 2 === 0 ? afternoonWindow : morningWindow,
  });
  assert(!result.startsWith("2026-09-30"));
}

console.log(JSON.stringify({ status: "passed", validCases: 6, failureCases: 3, sampledPatients: 1000 }));
