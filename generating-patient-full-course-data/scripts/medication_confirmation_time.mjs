const DAY_START_SECONDS = 6 * 3600;
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
  const serviceEnd = parseDateTime(patient.serviceEndDate, `${patient.userid}的服务结束日期`);
  const year = activation.getFullYear();
  const month = activation.getMonth();
  if (
    activation.getFullYear() === serviceEnd.getFullYear()
    && activation.getMonth() === serviceEnd.getMonth()
    && activation.getDate() === serviceEnd.getDate()
  ) {
    throw new Error(`${patient.userid}的激活日期不能为服务周期最后一天，请修改激活日期`);
  }
  const monthEndExclusive = new Date(year, month + 1, 1);
  const confirmationEndExclusive = serviceEnd < monthEndExclusive ? serviceEnd : monthEndExclusive;
  const lastLegalDate = new Date(confirmationEndExclusive);
  lastLegalDate.setDate(lastLegalDate.getDate() - 1);
  const lastDay = lastLegalDate.getFullYear() === year && lastLegalDate.getMonth() === month ? lastLegalDate.getDate() : 0;
  const activationSeconds = activation.getHours() * 3600 + activation.getMinutes() * 60 + activation.getSeconds();
  const windows = [];
  let totalSeconds = 0;

  for (let day = activation.getDate(); day <= lastDay; day += 1) {
    const startSeconds = day === activation.getDate() ? Math.max(DAY_START_SECONDS, activationSeconds + 1) : DAY_START_SECONDS;
    if (startSeconds > DAY_END_SECONDS) continue;
    const length = DAY_END_SECONDS - startSeconds + 1;
    windows.push({ day, startSeconds, length, offset: totalSeconds });
    totalSeconds += length;
  }

  if (!totalSeconds) throw new Error(`${patient.userid}在服务周期结束日前不存在严格晚于激活时间且位于06:00:00至21:59:59的合法确认时间`);
  const selectedOffset = Math.floor(stableRandom(patient.userid, `medication-confirmation-before-${patient.serviceEndDate}-06-22`) * totalSeconds);
  const window = windows.find(({ offset, length }) => selectedOffset < offset + length);
  const secondsOfDay = window.startSeconds + selectedOffset - window.offset;
  const result = new Date(year, month, window.day, Math.floor(secondsOfDay / 3600), Math.floor((secondsOfDay % 3600) / 60), secondsOfDay % 60);
  return formatDateTime(result);
}
