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
  "combinedMedication": ["药物通用名1", "药物通用名2"],
  "prescriptionList": "完整中文处方",
  "surgeryName": "规范手术名称或空字符串",
  "coursePlanName": "个性化方案名称"
}
```

Rules:

- `allergyHistory` must equal the source value. Do not add or delete known allergies.
- `combinedMedication` must be a unique JSON array containing 1–5 clinically supported drug generic names. When the source product type is medicinal, include the supplied product first. AI must add every first-line or directly indicated medication that can be selected safely from disease, age, sex, and allergy history, but it must not target a fixed count, randomize the count, or add an unrelated drug merely to create variation. If no additional medication is supportable without missing clinical facts, the reviewed product may remain the sole medication.
- Generate `prescriptionList` only after `combinedMedication` is final. Split the prescription at ` + `: the number of prescription entries must equal the medication count, and entry N must begin with medication N's exact name. AI-added medications must never lack their own complete prescription entry. This same-order one-to-one mapping prevents omissions, duplicates, and extra prescription drugs.
- Keep warnings, allergy substitutions, clinician-review text, and the postoperative-stage label inside the corresponding final prescription entry; never create a standalone ` + ` segment for non-drug text.
- Each prescription entry uses `药品名 + 规格 + 每次用量 + 给药途径 + 频次 + 服药时机 + 疗程`; join complete entries with the exact separator ` + `.
- Do not use `tid`, `bid`, `qd`, `q8h`, `prn`, `ivgtt`, `im`, `po`, `适量`, `酌情`, or `必要时`.
- For surgery patients with actual medications, end with `【术后用药阶段：<产品名称>植入术后】` or an equally specific surgery-stage label.
- `coursePlanName` must reflect the disease, phase, and product when relevant. Do not include age or sex labels.

## Output Workbook

Use the bundled template with these exact 17 columns:

`序号 | userid | 患者姓名 | 激活时间 | 性别 | 年龄 | 疾病 | 手机号码 | 地区 | 患者标签 | 既往过敏史 | 联合用药 | 处方清单 | 手术名称 | 全病程方案名称 | AI状态 | 确认状态`

- Columns `A:K`: copied from source.
- `L`: medications joined with `+`, not JSON text.
- `M:O`: generated prescription, surgery, and course-plan values.
- `P`: `已生成`.
- `Q`: `待确认`.
