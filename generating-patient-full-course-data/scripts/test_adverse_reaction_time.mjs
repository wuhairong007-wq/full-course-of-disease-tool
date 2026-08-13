import assert from "node:assert/strict";
import { generateAdverseReactionTime } from "./adverse_reaction_time.mjs";

const cases = [
  ["U-DAY", "2026-07-06 19:36:59"],
  ["U-EARLY", "2026-07-06 03:20:00"],
  ["U-LATE", "2026-07-06 22:30:00"],
  ["U-MONTH-END", "2026-07-31 10:09:33"],
  ["U-END-SECOND", "2026-07-31 21:59:58"],
];

for (const [userid, activationText] of cases) {
  const resultText = generateAdverseReactionTime({ userid, activateTime: activationText });
  const activation = new Date(activationText.replace(" ", "T"));
  const result = new Date(resultText.replace(" ", "T"));
  assert(result > activation, `${userid}发生时间必须严格晚于激活时间`);
  assert.equal(result.getFullYear(), activation.getFullYear(), `${userid}年份改变`);
  assert.equal(result.getMonth(), activation.getMonth(), `${userid}月份改变`);
  const secondsOfDay = result.getHours() * 3600 + result.getMinutes() * 60 + result.getSeconds();
  assert(secondsOfDay >= 6 * 3600, `${userid}早于06:00:00`);
  assert(secondsOfDay <= 21 * 3600 + 59 * 60 + 59, `${userid}晚于21:59:59`);
  assert.equal(generateAdverseReactionTime({ userid, activateTime: activationText }), resultText, `${userid}结果不稳定`);
}

assert.throws(
  () => generateAdverseReactionTime({ userid: "U-NO-WINDOW", activateTime: "2026-07-31 21:59:59" }),
  /当月不存在严格晚于激活时间且位于06:00:00至21:59:59的合法发生时间/,
);

console.log(JSON.stringify({ status: "passed", cases: cases.length, noWindowCases: 1 }));
