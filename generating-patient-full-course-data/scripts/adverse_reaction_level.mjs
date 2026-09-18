const normalize = (value) => String(value ?? "").trim();

export function normalizeAdverseReactionLevel(value) {
  const level = normalize(value);
  if (level === "无") return "正常";
  return level === "重度" ? "高度" : level;
}
