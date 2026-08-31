import assert from "node:assert/strict";
import { generateMedicationConfirmationTime } from "./medication_confirmation_time.mjs";

const cases = [
  ["U-DAY", "2026-07-06 19:36:59", "2026-07-01", "2026-07-31"],
  ["U-EARLY", "2026-07-06 03:20:00", "2026-07-01", "2026-07-31"],
  ["U-LATE", "2026-07-06 22:30:00", "2026-07-01", "2026-07-31"],
  ["U-MONTH-END", "2026-07-31 10:09:33", "2026-07-01", "2026-08-01"],
  ["U-END-SECOND", "2026-07-31 21:59:58", "2026-07-01", "2026-08-01"],
  ["U-SERVICE-START", "2026-06-20 10:00:00", "2026-07-01", "2026-07-31"],
];

for (const [userid, activationText, serviceStartDate, serviceEndDate] of cases) {
  const resultText = generateMedicationConfirmationTime({ userid, activateTime: activationText, serviceStartDate, serviceEndDate });
  const activation = new Date(activationText.replace(" ", "T"));
  const serviceStart = new Date(`${serviceStartDate}T00:00:00`);
  const serviceEnd = new Date(`${serviceEndDate}T00:00:00`);
  const result = new Date(resultText.replace(" ", "T"));
  assert(result > activation, `${userid}用药方案确认时间必须严格晚于激活时间`);
  assert(result >= serviceStart, `${userid}确认时间不得早于服务周期开始日期`);
  assert(result < serviceEnd, `${userid}确认时间不得落在服务周期最后一天`);
  const secondsOfDay = result.getHours() * 3600 + result.getMinutes() * 60 + result.getSeconds();
  assert(secondsOfDay >= 7 * 3600, `${userid}早于07:00:00`);
  assert(secondsOfDay <= 21 * 3600 + 59 * 60 + 59, `${userid}晚于21:59:59`);
  assert.equal(generateMedicationConfirmationTime({ userid, activateTime: activationText, serviceStartDate, serviceEndDate }), resultText, `${userid}结果不稳定`);
}

assert.equal(
  generateMedicationConfirmationTime({ userid: "U-LAST-SECOND", activateTime: "2026-07-30 21:59:58", serviceStartDate: "2026-07-01", serviceEndDate: "2026-07-31" }),
  "2026-07-30 21:59:59",
);

assert.throws(
  () => generateMedicationConfirmationTime({ userid: "U-SERVICE-END", activateTime: "2026-07-31 10:00:00", serviceStartDate: "2026-07-01", serviceEndDate: "2026-07-31" }),
  /U-SERVICE-END的激活日期不能为服务周期最后一天，请修改激活日期/,
);

assert.throws(
  () => generateMedicationConfirmationTime({ userid: "U-NO-WINDOW", activateTime: "2026-07-30 21:59:59", serviceStartDate: "2026-07-01", serviceEndDate: "2026-07-31" }),
  /不存在严格晚于激活时间且位于服务周期内的合法确认时间/,
);

console.log(JSON.stringify({ status: "passed", cases: cases.length, boundaryCases: 3 }));
