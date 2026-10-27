# Drug Specification Rules

## Core Requirement

Treat `药品通用名 + 剂型 + 规格 + 每次用量 + 给药途径` as one indivisible medication candidate. Confirm the specification and unit convention before writing a prescription entry. A clinically indicated drug with a fabricated, converted, or dosage-form-incompatible specification is not an acceptable prescription.

Use an approved product instruction, source-reviewed product data, or an established drug-specific rule for the exact dosage form. Never infer that two units are interchangeable merely because their numeric values look similar. Never silently convert mass, volume, potency, activity, or biological units.

## Priority

1. Exact drug-and-dosage-form rule.
2. Source-reviewed or approved-instruction specification for the selected product.
3. Dosage-form convention only as a structural fallback; it cannot determine an unknown strength.
4. If the exact strength, unit, dose, frequency, route, timing, or duration is not already known, first perform an active web search for the exact product and dosage form. Prioritize current regulator records, official manufacturer instructions, pharmacopoeia or other authoritative primary sources, then applicable guidelines and high-quality clinical references. Read the relevant source content, record the source and the supported parameter, and distinguish exact-product evidence from similarly named or combination products.
5. If the active search is complete and an exact parameter still cannot be supported, stop prescription generation for the affected patient or batch and report the product, parameter, search scope, sources checked, and unresolved gap. 检索完成后仍无法核实时，报告缺口（含已查来源和已确认项目）；不得要求操作者提供说明书、审核材料、批准文件或其他临床资料；do not infer, convert, or borrow the value from a similar product. Real mode still stops without output. Authorized fictional stage 1 uses an internal `simulation-only` parameter catalog with complete non-empty name, specification, dose, route, frequency, timing and concrete duration when a lawful simulation scenario can be formed; only an explicit `待核实` request or an impossible simulation scenario uses `research-gap-draft.md`.

After any equivalent medication substitution, discard the previous candidate's specification, dose, route, frequency, timing, duration, and warnings. Rebuild and validate the entire prescription entry for the final selected medication.

## Strict Drug Rules

| Drug | Dosage form | Allowed specification convention | Valid example | Forbidden example |
|---|---|---|---|---|
| 注射用胰蛋白酶 | 注射用无菌制剂 | Potency/activity units expressed as `单位` or `万单位`; an optional package denominator may be `/支` or `/瓶` | `5万单位`, `5万单位/支` | `5mg`, `0.005g` |
| 氟比洛芬凝胶贴膏 | 外用贴膏剂 | `mg/贴` | `40mg/贴` | `40mg/片`, `40mg/支` |

For `注射用胰蛋白酶`, the single dose must also use a supported potency/activity expression or a clearly corresponding whole-vial quantity. Do not write a mass-unit single dose after an activity-unit specification.

## Dosage-Form Structural Fallback

- Tablets: a package denominator, when present, must be `/片`; never `/粒`.
- Capsules: a package denominator, when present, must be `/粒`; never `/片`.
- Injectable powders and injections: use the exact approved mass, concentration, volume, potency, activity, or biological-unit convention for that product. The words `注射用` do not imply that `mg` is always valid.
- Oral liquids, drops, sprays, and solutions: preserve the approved concentration-and-volume structure; do not replace it with a tablet-style `/片` or capsule-style `/粒` expression.
- Biological products, enzymes, insulin, heparins, thrombolytics, and other potency-labelled products require exact drug-specific verification. Do not default them to `mg` or `g`.

Structural fallback rules can reject an impossible form, but they cannot invent a marketed strength. If a drug is not in the strict table and its approved unit is uncertain, obtain a reviewed specification before generation.

## Prescription Check

Before returning each entry, confirm all of the following:

1. The entry starts with the exact medication name from `combinedMedication`.
2. `规格` contains a numeric strength or potency and its correct unit convention.
3. A package denominator matches the dosage form.
4. `每次用量` is compatible with the specification unit and route.
5. The administration route is valid for the selected dosage form.
6. No parameter remains from an equivalent candidate that was not selected.

The workbook builder performs a final deterministic check. A strict-rule mismatch must report the affected `userid`, medication name, and invalid specification and must stop output rather than write an unsafe workbook.
