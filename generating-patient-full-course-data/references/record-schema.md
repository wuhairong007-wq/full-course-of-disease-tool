# Record Schema and Workbook Contract

The input, six-key record, source preservation and 17-column workbook contracts apply to both modes. Clinical evidence, role-review and equivalent-selector instructions below describe real mode. Explicitly authorized fictional test data follows `fictional-test-mode.md` for scenario generation and its separate review envelope, while retaining the shared allergy, specification, wording, company and output checks. Fictional assumptions never overwrite actual source values.

## Input

The first worksheet must contain these exact headers:

`序号 | userid | 患者姓名 | 激活时间 | 性别 | 年龄 | 疾病 | 手机号码 | 地区 | 患者标签 | 既往过敏史 | 产品名称 | 产品类型`

Each source row is one patient. Preserve row count, order, values, and `userid` exactly.

Optional source columns: `疼痛程度`, `疼痛评分`, `炎症表现`, `症状`, `症状描述`, `主诉`, `症状持续时间`, `晨僵时间`, `关节肿胀`, `活动受限`. The extractor retains populated values in `symptomEvidence` under their original column names, trimming surrounding whitespace and representing numbers as text. Preserve `0`, `无痛`, `无红肿` and other negative observations. Omit empty values; when no populated optional values exist, omit `symptomEvidence` entirely. Never assign missing values randomly or interpret `患者标签` as a symptom. This extractor-only object is not an additional key in the final six-key records or a new output column.

Before generating records, complete the five-role review in `clinical-rules.md` and write the temporary `medication-review.json`. Use 3～5 drugs when independently supported, or one/two when that is all the evidence supports. Do not stop after copying the source product, and do not force a minimum of three.

Optional clinical-context columns: `合并疾病`, `既往病史`, `当前用药`, `用药效果`, `肝功能`, `肾功能`, `妊娠状态`, `哺乳状态`, `手术史`. Non-empty values are retained under the original headers in extractor-only `clinicalContext`, with the same normalization as symptomEvidence; omit the object when all are empty. These fields guide indication and safety assessment, but history does not establish a current procedure or an active diagnosis. Do not infer a normal organ function or negative pregnancy status from absence.

Follow `medication-review-schema.md` for the review JSON contract and required `--review` builder argument. The builder verifies source facts against the original workbook and selection against the final medication list. It cannot validate the truth of clinical reasoning or guarantee patient suitability.

## Generated JSON

Return one object per source row with exactly these keys in this order:

```json
{
  "userid": "source userid",
  "allergyHistory": "source allergy or 无",
  "combinedMedication": ["药物通用名1", "药物通用名2", "药物通用名3"],
  "prescriptionList": "完整中文处方",
  "surgeryName": "规范手术名称或空字符串",
  "coursePlanName": "个性化方案名称"
}
```

Rules:

- `allergyHistory` must equal the source value. Do not add or delete known allergies.
- Before writing `combinedMedication`, exclude every explicitly documented allergen and every member of an explicitly documented allergy class. Match drug allergens against active-ingredient, dosage-form, salt, and combination-product names. Apply the same check to a medicinal source product; if the product conflicts, stop and report the patient instead of including or silently replacing it, except when `公司=山东利赛医药有限公司` and `产品类型=用药`, where the source `产品名称` is excluded from both generated medication fields. Do not broaden an isolated ingredient allergy to an entire class unless reviewed evidence supports that cross-reactivity; choose a supported non-conflicting alternative or stop when safety remains uncertain.
- `combinedMedication` must be a unique JSON array containing 1–5 clinically supported drug generic names. When the source product type is medicinal, include the supplied product first. AI must add every safely determinable etiologic, first-line, maintenance, mandatory postoperative, and directly supported symptom-treatment role. Clinical need determines the count: retain a clinically supportable monotherapy or dual therapy regimen where indicated, including uncomplicated vulvovaginal candidiasis and other local vaginal infection regimens that do not require a third drug. Do not default every patient to the same number, randomize the number, or add an unrelated or contraindicated drug merely to reach an arbitrary count. If no medication is supportable without inventing clinical facts, stop and report the affected `userid`.
- When `公司=山东利赛医药有限公司` and `产品类型=用药`, omit the exact source `产品名称` from `combinedMedication` and omit its corresponding active `prescriptionList` entry. Retain other safe, directly indicated medications; an empty result is invalid and must be reported rather than padded. With an empty or different `公司`, the medicinal product remains the first item.
- For a treatment role with multiple eligible equivalents, use `scripts/equivalent_medication_selector.mjs` after clinical filtering. 不得同时开具同一治疗作用的多个等效候选药物. The stable selector may vary the chosen equivalent, but it must not vary the role set or medication count.
- After drafting all records, review every same-disease cohort with at least two patients. When a shared role has multiple eligible equivalents, verify that each eligible patient used the stable selector rather than inheriting one disease-wide default. Regenerate the entire matching prescription entry after any equivalent substitution. Identical regimens are valid when only one safe candidate remains or patient-specific facts leave one supported option; never change roles, medication counts, doses, or durations merely to manufacture diversity.
- Generate `prescriptionList` only after `combinedMedication` and every equivalent selection are final. Split the prescription at ` + `: the number of prescription entries must equal the medication count, and entry N must begin with medication N's exact name. AI-added medications must never lack their own complete prescription entry. This same-order one-to-one mapping prevents omissions, duplicates, and extra prescription drugs.
- The allergy-safe medication set controls both output fields: no medication conflicting with `allergyHistory` may appear in `combinedMedication` or as an active prescription item in `prescriptionList`. Re-run the allergy check after every equivalent substitution and before workbook export.
- 等效替换后，药品名、规格、每次剂量、给药途径、频次、服药时机、疗程和专项警示必须全部对应最终选中的药物；不得保留被替换药物的规格、剂量、频次、疗程或警示。
- Before writing each entry, validate the exact drug and dosage form against `drug-specification-rules.md`. The specification must use the drug's supported mass, volume, concentration, potency, activity, or biological-unit convention. Do not guess or silently convert units.
- `给药途径` must be an AI clinical judgment based on disease site, treatment role, treatment setting, patient safety facts, the drug dosage form（药品剂型）, and the route supported by its instructions（药品说明书）or reviewed product data（已审核药品数据）. Do not hard-code a disease to one route or default every injectable product to `肌内注射`. For airway-clearance goals, assess whether `雾化吸入` is the supported and clinically appropriate route; for ophthalmic or soft-tissue goals, assess the corresponding local route. These are reasoning cues, not unconditional mappings. If route fit is uncertain or conflicts with the dosage form/approved route, stop and report the patient and drug instead of guessing.
- When route judgment changes, regenerate the entire candidate-owned prescription entry: specification, single dose, route, frequency, timing, duration, warnings, and any route-specific administration instructions must all match the final choice.
- `注射用胰蛋白酶` must use an activity specification such as `5万单位` or `5万单位/支`; `5mg` and `g`-based specifications are invalid. Tablet and capsule package denominators, when present, must match `/片` and `/粒` respectively.
- Keep specific safety/monitoring actions, allergy substitutions, and the postoperative-stage label inside the corresponding final prescription entry; never create a standalone ` + ` segment for non-drug text.
- Each prescription entry uses `药品名 + 规格 + 每次用量 + 给药途径 + 频次 + 服药时机 + 疗程`; join complete entries with the exact separator ` + `.
- Do not use `tid`, `bid`, `qd`, `q8h`, `prn`, `ivgtt`, `im`, `po`, `适量`, `酌情`, or `必要时`.
- For surgery patients with actual medications, end with `【术后用药阶段：<产品名称>植入术后】` or an equally specific surgery-stage label.
- `coursePlanName` must reflect the disease, phase, and product when relevant. Do not include age or sex labels.
- Generated fields must not contain language that references the source file or describes absent input, including `源文件`, `未提供`, `未获取`, `未记录`, or `暂无资料`. Omit unsupported facts and labels without fabricating replacements.

## Output Workbook

Use the bundled template with these exact 17 columns:

`序号 | userid | 患者姓名 | 激活时间 | 性别 | 年龄 | 疾病 | 手机号码 | 地区 | 患者标签 | 既往过敏史 | 联合用药 | 处方清单 | 手术名称 | 全病程方案名称 | AI状态 | 确认状态`

- Columns `A:K`: copied from source.
- `L`: medications joined with `+`, not JSON text.
- `M:O`: generated prescription, surgery, and course-plan values.
- `P`: `已生成`.
- `Q`: `待确认`.

## Delivery Gate

The final deliverable for `生成患者明细` is this 17-column workbook, with one worksheet and one table. Do not add candidate, evidence, missing-condition, or review-status columns/sheets, and do not substitute an assessment workbook for this output.

When the request includes `最少种数：N`, invoke `build_workbook.mjs --min-medications N` (integer 1–5). The builder verifies the final selected medications after company exclusions and clinical/review checks, before writing the output. Failure leaves any existing output intact; an existing file is not proof that the current run succeeded. If the user did not specify a minimum, the default lower bound remains one.

On failure, report the unfulfilled request and concrete reasons in chat. Detailed search and candidate assessments remain internal unless separately requested. A correctly shaped workbook cannot be produced by fabricating clinical facts or counting unselected alternatives as active medications.
