# Clinical Generation Rules

## Safety Boundary

Generate simulated discharge records, not real prescriptions. Use only source disease, age, sex, product, product type, and allergy history. Do not invent symptoms, test results, pathology, stage, comorbidities, organ function, weight, contraindications, or efficacy claims. Add a clinician-review statement to each prescription.

Every completed record must contain 3–5 clinically justified medications. When `产品类型=用药`, treat the supplied `产品名称` as a source-reviewed medication and include it first. Then independently evaluate first-line disease treatment, maintenance or mandatory postoperative therapy, and every directly indicated adjunct from disease, procedure, age, sex, allergy history, product, and reviewed surgery. Finally evaluate each 有明确依据的对症支持药物. Continue the complete assessment until at least three distinct treatment roles are represented, subject to the five-drug cap. Within the 3–5 range, let clinical need determine the count; do not default every patient to the same number, randomize the number, or add an unrelated or contraindicated drug merely to reach three. If fewer than three safe, directly indicated medications remain after the complete assessment, stop and report the affected `userid` instead of writing an incomplete or padded record.

## Symptom-Supportive Medication Gate

Add a symptom-supportive medication only when the named disease, standard procedure, or already selected treatment itself establishes a recognized indication without inventing a symptom. Examples include quantified short-course non-opioid analgesia after an operation, sputum clearance after a procedure that impairs airway clearance, and bowel management when the supplied operation itself creates a standard postoperative constipation risk. Infection treatment still requires explicit infectious evidence in the diagnosis or procedure context.

Do not infer dyspepsia, nausea, hepatic injury, electrolyte deficiency, vitamin deficiency, dysbiosis, or malnutrition. Without direct evidence, do not add proton-pump inhibitors, antacids, hepatoprotective drugs, antiemetics, prokinetics, laxatives, electrolytes, vitamins, probiotics, or nutritional supplements merely to make the regimen look complete. Existing procedure-specific default rules take precedence only when they expressly establish the risk and permitted drug class.

Prioritize source-reviewed and indispensable core therapy over optional symptom support. If more than five roles are selected, remove the lowest-priority optional support role first. Never remove indispensable core therapy to preserve a support drug. If more than five indispensable roles remain, stop and report the affected `userid`.

## Generated Wording

Never describe absent input or mention the source file in generated content. Prohibited wording includes `源文件未提供`, any other phrase containing `源文件`, `未提供`, `未获取`, `未记录`, `暂无资料`, and semantic equivalents. When a fact is unavailable and cannot be inferred safely, omit the fact and its label. Never fabricate a symptom, sign, test result, diagnosis, or history to replace the omission.

## Equivalent Hospital-Preference Variation

Create an equivalent candidate group only for drugs with the same disease indication, treatment role, treatment-line status, route, and phase of care. Filter the group for age, allergy, contraindication, and interaction safety before selection. 同一治疗作用只选择一种; never prescribe multiple alternatives from the same group together, and never use a supportive candidate to replace core therapy.

Use `userid + 疾病 + 治疗作用` as the stable selection key with `scripts/equivalent_medication_selector.mjs`. The userid is a reproducibility key, not a clinical indication: it may select one option within an already eligible group but must not create a treatment role, change medication count, bypass safety filters, or justify cross-indication use. The same patient and eligible group must reproduce the same choice even if candidate input order changes. Different userids may select different eligible equivalents, representing institution-level prescribing preference. When only one safe candidate remains, use it directly and do not manufacture variation.

First finalize `combinedMedication`, including all equivalent selections, then derive `prescriptionList` from it in the same order with exactly one complete prescription entry per medication. Every medication added by AI must receive a complete matching prescription entry; never add a prescription drug absent from `combinedMedication`. After a substitution, regenerate all prescription parameters and warnings from the selected candidate; never retain parameters from a discarded alternative.

## Same-Disease Cohort Diversity Review

After drafting all Stage 1 records, group patients by disease and review every same-disease cohort containing at least two patients. For each treatment role with multiple eligible equivalents after patient-specific indication, treatment-line, route, phase, age, allergy, contraindication, interaction, product, and surgery filtering, verify that every eligible patient used the stable selector. Do not let the first generated regimen become an unreviewed default for the whole disease group. When an equivalent choice changes, regenerate the medication name, specification, dose, route, frequency, timing, duration, and warnings as one candidate-owned prescription set.

An all-identical cohort is acceptable when only one safe candidate remains for each role or patient-specific facts independently support the same choice. Stable hash collisions may also occur in small groups; diversity means opening clinically equivalent choices, not forcing every row to be unique. Never change treatment roles, medication counts, doses, or durations merely to create diversity, and never introduce a non-equivalent or less appropriate drug for cosmetic variation.

## Disease-Aware Route Judgment

给药途径必须由 AI 结合疾病解剖部位、具体治疗作用、治疗场景、药品剂型、药品说明书或已审核药品允许的途径，以及患者年龄、过敏史和其他已知安全信息综合判断。不得建立“疾病名称→固定给药途径”的硬编码映射，也不得因为药品是注射剂就默认使用肌内注射。

先判断药物是在进行气道廓清、眼科局部治疗、软组织局部处理、全身抗感染、镇痛还是其他治疗，再从该药物被支持的途径中选择与目标最匹配的一种。例如，呼吸系统疾病涉及气道廓清时，AI 应评估雾化吸入是否比肌内注射更符合目标；眼科疾病应评估眼科局部用药；软组织损伤应评估局部注射或外用。上述仅是推理线索，不是疾病到途径的一对一规则；同一药物在不同疾病或治疗目标下可以有不同合理途径。

如果草拟途径与疾病部位、治疗目标或药品允许途径冲突，必须重新选择候选并同步重建规格、每次用量、给药途径、频次、时机、疗程和专项警示，禁止只改处方中的途径字段。若在现有已审核依据下无法确认安全且适用的途径，停止该患者生成并报告患者、药物和冲突原因，不能用“肌内注射”作为默认兜底。

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

- Read `drug-specification-rules.md` before creating any prescription. Treat drug name, dosage form, specification, single dose, and route as one validated set. Exact drug rules override generic dosage-form conventions.
- Use only a supported approved specification for the exact selected dosage form. Never invent a marketed strength or silently convert mass, volume, potency, activity, or biological units.
- `注射用胰蛋白酶` is potency-labelled: use specifications such as `5万单位` or `5万单位/支`; never generate `5mg` or another mass-unit specification.
- After an equivalent substitution, rebuild and revalidate the final drug's specification and dose; no parameter may remain from the discarded candidate.
- Age 18–64: use guideline-standard adult starting doses.
- Age 65+: use a conservative 1/2–2/3 starting dose when appropriate and include `需根据肌酐清除率调整`.
- Age under 18: use a weight-based reference range only when weight-independent bounds are safe. Omit any otherwise optional medication whose safe dose cannot be stated without weight; stop only if no source-reviewed or directly indicated medication can be prescribed safely. Never use fluoroquinolones, tetracyclines, or aspirin.
- Acetaminophen: include `每日极量2g，禁与含同成分复方制剂同服`.
- NSAIDs: include the mandatory gastrointestinal/cardiovascular warning; never use after gastrointestinal surgery.
- Anticoagulants: include meal timing when required, bleeding monitoring, avoidance of strenuous activity, and a clear review/duration point.
- Hormone replacement, targeted therapy, and nutritional supplements: include timing, duration, monitoring, and separation requirements.
