const normalize = (value) => String(value ?? "").trim();

export function normalizeAdverseReactionLevel(value) {
  const level = normalize(value);
  return level === "重度" ? "高度" : level;
}
