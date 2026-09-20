import {
  formatDateTime,
  getActivationTimeWindow,
  parseDateTime,
  selectStableTimeInWindow,
} from "./activation_time_windows.mjs";

const CONFIRMATION_WINDOW_MS = 7 * 24 * 3600 * 1000;

export function generateMedicationConfirmationTime(patient) {
  const target = getActivationTimeWindow({
    userid: patient.userid,
    activateTime: patient.activateTime,
    eventType: "medication-confirmation",
  });
  const serviceStart = parseDateTime(patient.serviceStartDate, `${patient.userid}的服务开始日期`);
  const serviceEnd = parseDateTime(patient.serviceEndDate, `${patient.userid}的服务结束日期`);
  if (
    target.activation.getFullYear() === serviceEnd.getFullYear()
    && target.activation.getMonth() === serviceEnd.getMonth()
    && target.activation.getDate() === serviceEnd.getDate()
  ) {
    throw new Error(`${patient.userid}的激活日期不能为服务周期最后一天，请修改激活日期`);
  }
  const latestByActivation = target.activation.getTime() + CONFIRMATION_WINDOW_MS;
  const start = new Date(Math.max(
    target.start.getTime(),
    serviceStart.getTime(),
    target.activation.getTime() + 1000,
  ));
  const end = new Date(Math.min(
    target.end.getTime(),
    serviceEnd.getTime() - 1000,
    latestByActivation,
  ));
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
}
