# Stage 1 Cohort Medication Diversity Design

## Problem

Stage 1 already supports stable equivalent-drug selection by `userid + disease + therapy role`, but its contract only says different patients may receive different equivalents. It does not require a cohort-level review, so a same-disease group can be generated with identical combined medications and prescriptions even when multiple safe equivalents exist.

## Design

After all Stage 1 records are drafted, group patients by disease and review every group containing at least two patients. When a treatment role has multiple candidates that remain equivalent after indication, treatment line, route, phase, age, allergy, contraindication, interaction, product, and surgery filtering, use the stable selector for every eligible patient. If the group still has identical selections despite multiple eligible equivalents, re-run the deterministic selection and regenerate each affected prescription from the final candidate-owned parameter set.

Variation is conditional, not cosmetic. Keep identical regimens when only one safe candidate remains or when patient-specific facts make the same option the only supported choice. Never vary the treatment-role set, medication count, dosage, or duration merely to make rows look different.

## Validation

Extend package validation to require the cohort-review contract in `SKILL.md`, `references/clinical-rules.md`, and `references/record-schema.md`. Existing selector tests continue to prove reproducibility and equivalent-choice diversity.

## Version

Increase `metadata.version` from `1.0.0` to `1.1.0` because this adds a Stage 1 generation rule without changing the input or output schema.

## Scope

Change Stage 1 instructions, its clinical and record-schema references, package validation, and the synchronized GitHub repository copy. Do not change templates, workbook columns, selectors, or clinical eligibility rules.
