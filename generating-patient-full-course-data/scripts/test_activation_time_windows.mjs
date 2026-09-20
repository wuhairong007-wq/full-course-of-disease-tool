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
assert.equal(first.getTime(), repeated.getTime());
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
