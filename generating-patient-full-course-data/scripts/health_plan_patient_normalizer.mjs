export function normalizeReviewedSurgeryName(value) {
  const surgeryName = String(value ?? "").trim();
  return /^\d+$/.test(surgeryName) ? "" : surgeryName;
}

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function normalizeCoursePlanNameForIntro(value, medications = []) {
  let coursePlanName = String(value ?? "").trim();
  for (const medication of medications) {
    const productSupportLabel = new RegExp(String.raw`[（(][^（）()\n]{0,80}${escapeRegExp(medication)}[^（）()\n]{0,40}支持\s*[）)]`, "g");
    coursePlanName = coursePlanName.replace(productSupportLabel, "");
  }
  return coursePlanName.replace(/\s{2,}/g, " ").trim();
}
