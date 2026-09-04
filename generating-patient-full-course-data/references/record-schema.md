# Record Schema and Workbook Contract

## Input

The first worksheet must contain these exact headers:

`序号 | userid | 患者姓名 | 激活时间 | 性别 | 年龄 | 疾病 | 手机号码 | 地区 | 患者标签 | 既往过敏史 | 产品名称 | 产品类型`

Each source row is one patient. Preserve row count, order, values, and `userid` exactly.

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
- `combinedMedication` must be a unique JSON array containing 3–5 clinically supported drug generic names. When the source product type is medicinal, include the supplied product first. AI must add every safely determinable etiologic, first-line, maintenance, mandatory postoperative, and directly supported symptom-treatment role. Continue the complete assessment until at least three safe treatment roles are represented. Within the 3–5 range, clinical need determines the count; do not default every patient to the same number, randomize the number, or add an unrelated or contraindicated drug merely to reach three. If fewer than three medications are supportable without inventing clinical facts, stop and report the affected `userid`.
- For a treatment role with multiple eligible equivalents, use `scripts/equivalent_medication_selector.mjs` after clinical filtering. 不得同时开具同一治疗作用的多个等效候选药物. The stable selector may vary the chosen equivalent, but it must not vary the role set or medication count.
- After drafting all records, review every same-disease cohort with at least two patients. When a shared role has multiple eligible equivalents, verify that each eligible patient used the stable selector rather than inheriting one disease-wide default. Regenerate the entire matching prescription entry after any equivalent substitution. Identical regimens are valid when only one safe candidate remains or patient-specific facts leave one supported option; never change roles, medication counts, doses, or durations merely to manufacture diversity.
- Generate `prescriptionList` only after `combinedMedication` and every equivalent selection are final. Split the prescription at ` + `: the number of prescription entries must equal the medication count, and entry N must begin with medication N's exact name. AI-added medications must never lack their own complete prescription entry. This same-order one-to-one mapping prevents omissions, duplicates, and extra prescription drugs.
- 等效替换后，药品名、规格、每次剂量、给药途径、频次、服药时机、疗程和专项警示必须全部对应最终选中的药物；不得保留被替换药物的规格、剂量、频次、疗程或警示。
- Before writing each entry, validate the exact drug and dosage form against `drug-specification-rules.md`. The specification must use the drug's supported mass, volume, concentration, potency, activity, or biological-unit convention. Do not guess or silently convert units.
- `给药途径` must be an AI clinical judgment based on disease site, treatment role, treatment setting, patient safety facts, the drug dosage form（药品剂型）, and the route supported by its instructions（药品说明书）or reviewed product data（已审核药品数据）. Do not hard-code a disease to one route or default every injectable product to `肌内注射`. For airway-clearance goals, assess whether `雾化吸入` is the supported and clinically appropriate route; for ophthalmic or soft-tissue goals, assess the corresponding local route. These are reasoning cues, not unconditional mappings. If route fit is uncertain or conflicts with the dosage form/approved route, stop and report the patient and drug instead of guessing.
- When route judgment changes, regenerate the entire candidate-owned prescription entry: specification, single dose, route, frequency, timing, duration, warnings, and any route-specific administration instructions must all match the final choice.
- `注射用胰蛋白酶` must use an activity specification such as `5万单位` or `5万单位/支`; `5mg` and `g`-based specifications are invalid. Tablet and capsule package denominators, when present, must match `/片` and `/粒` respectively.
- Keep warnings, allergy substitutions, clinician-review text, and the postoperative-stage label inside the corresponding final prescription entry; never create a standalone ` + ` segment for non-drug text.
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
