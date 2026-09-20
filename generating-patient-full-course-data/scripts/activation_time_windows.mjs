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
