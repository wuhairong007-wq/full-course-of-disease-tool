# Clinical Generation Rules

## Safety Boundary

Generate simulated discharge records, not real prescriptions. Use only source disease, age, sex, product, product type, and allergy history. Do not invent symptoms, test results, pathology, stage, comorbidities, organ function, weight, contraindications, or efficacy claims. Add a clinician-review statement to each prescription.

Every completed record must contain 1–5 clinically justified medications. When `产品类型=用药`, treat the supplied `产品名称` as a source-reviewed medication and include it first. Then independently evaluate first-line disease treatment and every directly indicated adjunct from disease, age, sex, and allergy history; add each supported medication until the clinically complete regimen is represented, subject to the five-drug cap. Do not stop after the product when another safe, directly indicated medication can be determined. Do not target a fixed medication count, randomize the count, or add an unrelated drug merely to create variation. If no additional medication can be selected without inventing missing clinical facts, retain the reviewed product as the sole medication.

First finalize `combinedMedication`, then derive `prescriptionList` from it in the same order with exactly one complete prescription entry per medication. Every medication added by AI must receive a complete matching prescription entry; never add a prescription drug absent from `combinedMedication`.

## Allergy

Preserve source allergy history exactly. If `无` or blank, use `无`; do not infer a new allergy. Exclude the allergen and its drug class. When an allergy changes drug selection, state `因XX过敏，改用XX` or a precise equivalent.

## Surgery

- `产品类型=器械`: provide a standard procedure matching disease and device use; the name must contain `产品名称`.
- Other product types: return `surgeryName: ""`.
- For cardiac pacemakers: atrial fibrillation with slow ventricular response generally maps to single-chamber permanent pacemaker implantation; sinus node dysfunction generally maps to dual-chamber rate-responsive implantation; high-grade/second-degree type II/third-degree AV block and bifascicular block generally map to dual-chamber implantation; carotid sinus hypersensitivity maps to dual-chamber implantation with rate-drop response when appropriate. For hypertrophic obstructive cardiomyopathy, use the conservative name `双腔永久心脏起搏器植入术` unless the source explicitly supplies a pacing mode; do not infer a short atrioventricular delay.
- Do not claim a procedure occurred if the product type is not a device.

## Medication Priority

Evaluate disease-maintenance therapy before short-term postoperative therapy. Do not treat a device as a drug.

For surgery patients:

1. Continue disease-specific therapy only when supported by the named disease.
2. Clean device implantation without infection evidence must not receive discharge antibiotics.
3. Evaluate pain for every surgery patient. A clean pacemaker incision may receive quantified short-course acetaminophen as routine postoperative pain management without asserting that pain is present. Do not invent a pain score or symptom severity. Avoid discharge opioids and strong antispasmodics.
4. Pacemaker implantation alone is not a VTE-high-risk abdominal, pelvic, lower-limb, or malignant radical operation; do not add postoperative anticoagulation solely for the incision.
5. Atrial fibrillation anticoagulation is disease-related. Because stroke-risk inputs are incomplete, use a conservative review-dependent plan with explicit bleeding monitoring; do not invent a CHA₂DS₂-VASc score.
6. For hypertrophic obstructive cardiomyopathy, prefer one guideline-aligned non-vasodilating beta blocker; do not combine a beta blocker with verapamil/diltiazem without explicit evidence.
7. Do not add proton-pump inhibitors, antiemetics, statins, electrolytes, prokinetics, laxatives, or supplements without a direct indication from the supplied fields.

For non-surgery patients:

1. List first-line etiologic/disease treatment plus the named medicinal product when it is a drug.
2. Add only directly indicated adjuncts.
3. For malignant tumors, never cross indications. If pathology or stage is insufficient for systemic therapy, retain only source-reviewed medicinal products and do not guess another antitumor drug.

## Dose and Warning Rules

- Age 18–64: use guideline-standard adult starting doses.
- Age 65+: use a conservative 1/2–2/3 starting dose when appropriate and include `需根据肌酐清除率调整`.
- Age under 18: use a weight-based reference range only when weight-independent bounds are safe. Omit any otherwise optional medication whose safe dose cannot be stated without weight; stop only if no source-reviewed or directly indicated medication can be prescribed safely. Never use fluoroquinolones, tetracyclines, or aspirin.
- Acetaminophen: include `每日极量2g，禁与含同成分复方制剂同服`.
- NSAIDs: include the mandatory gastrointestinal/cardiovascular warning; never use after gastrointestinal surgery.
- Anticoagulants: include meal timing when required, bleeding monitoring, avoidance of strenuous activity, and a clear review/duration point.
- Hormone replacement, targeted therapy, and nutritional supplements: include timing, duration, monitoring, and separation requirements.
