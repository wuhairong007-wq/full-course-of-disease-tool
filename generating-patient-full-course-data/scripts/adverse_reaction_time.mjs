import {
  formatDateTime,
  getActivationTimeWindow,
  selectStableTimeInWindow,
} from "./activation_time_windows.mjs";

export function generateAdverseReactionTime(patient) {
  const window = getActivationTimeWindow({
    userid: patient.userid,
    activateTime: patient.activateTime,
    eventType: "adverse-reaction",
  });
  if (
    window.start.getFullYear() !== window.activation.getFullYear()
    || window.start.getMonth() !== window.activation.getMonth()
  ) {
    throw new Error(
      `${patient.userid}的不良反应目标发生日期${window.startText.slice(0, 10)}跨月，停止生成`,
    );
  }

  return formatDateTime(selectStableTimeInWindow({
    userid: patient.userid,
    salt: "adverse-reaction-occurrence",
    start: window.start,
    end: window.end,
  }));
}
