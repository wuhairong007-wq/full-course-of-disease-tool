const DAY_START_SECONDS = 7 * 3600;
const DAY_END_SECONDS = 21 * 3600 + 59 * 60 + 59;

function parseDateTime(value, label) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(\d{4})[-\/]([01]?\d)[-\/]([0-3]?\d)(?:[ T]([0-2]?\d):([0-5]\d)(?::([0-5]\d))?)?$/);
  if (!match) throw new Error(`${label}格式无效，应为YYYY-MM-DD HH:mm:ss`);
  const [year, month, day, hour, minute, second] = [match[1], match[2], match[3], match[4] ?? "0", match[5] ?? "0", match[6] ?? "0"].map(Number);
  const date = new Date(year, month - 1, day, hour, minute, second);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute || date.getSeconds() !== second) throw new Error(`${label}不是有效时间`);
  return date;
}

function stableRandom(userid, salt) {
  let hash = 2166136261;
  for (const character of `${userid}|${salt}`) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}

function formatDateTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function generateMedicationConfirmationTime(patient) {
  const activation = parseDateTime(patient.activateTime, `${patient.userid}的激活时间`);
  const serviceStart = parseDateTime(patient.serviceStartDate, `${patient.userid}的服务开始日期`);
  const serviceEnd = parseDateTime(patient.serviceEndDate, `${patient.userid}的服务结束日期`);
  if (
    activation.getFullYear() === serviceEnd.getFullYear()
    && activation.getMonth() === serviceEnd.getMonth()
    && activation.getDate() === serviceEnd.getDate()
  ) {
    throw new Error(`${patient.userid}的激活日期不能为服务周期最后一天，请修改激活日期`);
  }
  const earliestLegalTime = Math.max(activation.getTime() + 1000, serviceStart.getTime());
  const firstLegalDate = new Date(earliestLegalTime);
  firstLegalDate.setHours(0, 0, 0, 0);
  const windows = [];
  let totalSeconds = 0;

  for (const date = new Date(firstLegalDate); date < serviceEnd; date.setDate(date.getDate() + 1)) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, DAY_START_SECONDS, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(0, 0, DAY_END_SECONDS, 0);
    const startTime = Math.max(dayStart.getTime(), earliestLegalTime);
    const endTime = Math.min(dayEnd.getTime(), serviceEnd.getTime() - 1000);
    if (startTime > endTime) continue;
    const length = Math.floor((endTime - startTime) / 1000) + 1;
    windows.push({ startTime, length, offset: totalSeconds });
    totalSeconds += length;
  }

  if (!totalSeconds) throw new Error(`${patient.userid}不存在严格晚于激活时间且位于服务周期内的合法确认时间（每日07:00:00至21:59:59）`);
  const selectedOffset = Math.floor(stableRandom(patient.userid, `medication-confirmation-${patient.serviceStartDate}-${patient.serviceEndDate}-07-22`) * totalSeconds);
  const window = windows.find(({ offset, length }) => selectedOffset < offset + length);
  const result = new Date(window.startTime + (selectedOffset - window.offset) * 1000);
  return formatDateTime(result);
}
