import { validateDrugSpecification } from "./drug_specification_validator.mjs";

const normalize = (value) => String(value ?? "").trim();

function normalizeExtractedSpecification(value) {
  const specification = normalize(value)
    .replace(/^[：:，,；;\s]+/, "")
    .replace(/[，,；;\s]+$/, "");
  if ((specification.startsWith("（") && specification.endsWith("）"))
    || (specification.startsWith("(") && specification.endsWith(")"))) {
    return specification.slice(1, -1).trim();
  }
  return specification;
}

export function extractMedicationSpecification(segment, medication) {
  const explicit = segment.match(/规格\s*[：:]?\s*([^，；+]+)/)?.[1];
  if (explicit) return normalizeExtractedSpecification(explicit);
  const medicationIndex = segment.indexOf(medication);
  if (medicationIndex < 0) return "";
  const remainder = segment.slice(medicationIndex + medication.length);
  const doseBoundary = remainder.search(/(?:每次|适量)/);
  if (doseBoundary < 0) return "";
  return normalizeExtractedSpecification(remainder.slice(0, doseBoundary));
}

export function validateMedicationListSpecification({ userid, medication, specification }) {
  const normalizedSpecification = normalize(specification);
  if (!/^\d/.test(normalizedSpecification) || /规格/.test(normalizedSpecification)) {
    throw new Error(`${userid}的${medication}规格必须以数值开头，且不得包含规格标签或前导标点`);
  }
  validateDrugSpecification({
    userid,
    medication,
    prescriptionEntry: `${medication} 规格${normalizedSpecification}`,
  });
}
