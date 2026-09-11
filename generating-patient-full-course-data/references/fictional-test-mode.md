# 虚构测试患者明细

## 调用与边界

本模式生成明确授权的虚构测试文件。接受 `模式：虚构测试`，或当前任务中已明确给出的同等授权；不能仅凭“最少种数”自动切换。默认仍为真实患者模式。用户在同一任务中确认虚构后，后续“继续生成”沿用该授权。

```text
生成患者明细
依据文件：/path/source.xlsx
公司：江苏壹号畅达药业有限公司
最少种数：3
模式：虚构测试
```

- 最终文件名必须含 `虚构测试`。只在文件名标识，不在单元格内增加“虚构”“模拟病情”或免责声明，不增加列、工作表或审核附件。
- 保留原有17列、全部患者、顺序、源字段及 `已生成/待确认` 状态。联合用药与处方清单逐药一一对应，方案名称不含产品名称。
- `最少种数` 为1～5的整数，省略为1；生成器和导出器均必须传入用户指定值。以公司排除规则和过敏筛选后实际导出的独立药品数计数，不足即失败，不能降为1～2种后交付。当前内置库每条为3种，传入3时逐条验证至少3种。
- AI可为测试构造与疾病相容的假设情境，但只记录在内部方案库及情境分配中。年龄、疾病、性别、过敏史和已有症状等源信息不可改写；已知临床信息不匹配方案库时必须停止。假设不能被描述为真实患者已发生的症状、正常检查结果或已确认的用药事实。
- 不要求用户提供品牌或批准文号。必须核对通用名、剂型、规格、剂量、途径、频次、疗程、相互作用与禁忌；不可为达到数量而叠加同类替代药或无关药。
- 沿用所有字段的文案限制，包括禁用 `由临床医生xxx`、`由医生xxx`、`由医师xxx`、缺失输入占位文案。后续真实患者任务不得将本文件当成已审核真实处方。

## 正式生成命令

在技能目录执行，临时目录存内部记录，不将其作为患者明细交付：

```bash
<bundled-node> scripts/generate_fictional_test_records.mjs \
  --mode fictional-test \
  --input <source.xlsx> \
  --company <company> \
  --min-medications 3 \
  --records <temp>/records.json \
  --review <temp>/fictional-review.json

<bundled-node> scripts/build_workbook.mjs \
  --mode fictional-test \
  --input <source.xlsx> \
  --company <company> \
  --min-medications 3 \
  --records <temp>/records.json \
  --review <temp>/fictional-review.json \
  --template assets/patient-full-course-template.xlsx \
  --output <source-stem>_患者全病程数据_虚构测试.xlsx \
  --preview <temp>/preview.png
```

两步必须使用同一源文件、公司和最少种数。公司省略时两步都省略。默认在源目录输出；无写权限时使用工作区 `outputs/patient-full-course/<source-stem>/`。不得覆盖源文件或模板。生成器可接收 `--catalog <researched-catalog.json>`；导出器使用审核文件中绑定的同一方案库。

生成器产出六字段记录和 `fictional-test-review/v1` 情境记录：`sourceSHA256`、`company`、`minimumMedications`、完整 `catalog`、逐人 `assignments`（userid、scenarioId）和 `metrics`。导出器核对源文件SHA256，重新按实际源数据生成并逐项比对记录与分配，执行共同处方校验后再写Excel。真实模式拒绝此情境记录，不能伪造真实五角色审核来绕过检查。

## 处方丰富性

先按每人的已知事实和方案库限制筛选，再选择情境。候选之间只能是已核对适用范围的等效选择，每个治疗作用最多保留一个药物。

全批目标为 `min(可用实质处方数, ceil(sqrt(记录数)))`，同病种内优先均衡，兼顾全批分布。userid哈希仅用于稳定打破并列，不产生真实诊断或适应证。受限患者的覆盖优先于软性多样性目标；少量患者、过敏限制等可能影响实际覆盖。相同输入与方案库可重复得到相同结果。

实质去重键包含通用名、规格、单次剂量、途径、频次、疗程，并忽略药品顺序、注意事项措辞和标点。不能靠换行、同义表达或排列组合宣称增加处方种类。记录越多，在已核对的相容方案范围内逐步增加覆盖，达到库容量后停止增加；要超过上限须先核对扩展方案，不能无限随机拼药或随意更改剂量疗程。

## 内置方案库

`assets/fictional-osteoarthritis-catalog.json` 适用于库中列明的8类成人骨关节炎、18～80岁、指定产品 `硫酸氨基葡萄糖胶囊`，以及明确列出的过敏史。当前 `scope.evidenceMatches` 为空，表示仅覆盖没有额外临床信息的测试源表；有疼痛评分（包括0）、妊娠状态、当前用药等源信息时，不可覆盖或丢弃，须先研究适配方案库。

库内包含产品加一个口服NSAID和一个PPI的假设情境，共12种药品组合、24种实质处方。NSAID/PPI为同期3天或5天，65岁及以上仅分配3天情境，磺胺类过敏排除塞来昔布。已有过敏史未列入核对范围时停止，不假设其不影响用药。内部假设包括适用的疼痛加重情境，以及排除相应禁忌和相互作用的测试前提；它们不是对源患者的事实断言。

依据保存在库内 `sources`，包括《中国骨关节炎诊疗指南（2024版）》、NICE NG226和各候选药品说明书。指南存在差异：NICE不推荐氨基葡萄糖；保留源产品不代表所有指南均认可该三药方案。口服NSAID与胃保护的依据也不等同于所有真实骨关节炎患者均需三药。国外说明书仅支持对应参数核对，不冒充国内批准信息。机器校验验证结构与已编码限制，不能证明真实患者临床适用性。

其他疾病、产品、儿童、超出年龄范围或未覆盖临床信息不能套用骨关节炎库。`公司=山东利赛医药有限公司` 时仍排除源药品，内置库仅余2种，最少种数3必须失败；最少种数4或5也不能由现有三药库填充。

## 扩展方案库

先检索对应疾病指南和官方说明书，区分可联合用药与互为替代项，核对适用人群、禁忌、过敏、剂量、疗程和相互作用，再创建 JSON：

- `kind: fictional-medication-catalog/v1`、唯一 `id`、`reviewedOn: YYYY-MM-DD`。
- `scope`：明确 `diseases`、`productName`、`productType: 用药`、成年 `minAge/maxAge`、已核对 `allergyHistories` 和源临床字段的精确匹配 `evidenceMatches`。不能通过删除源信息或放宽已知禁忌匹配。
- `planSuffix`：疾病后的方案名称，不含药品名；`assumptions`：明确的测试前提数组。
- `sources`：每项有可查证 `name`、`url`、所支持用途及限制 `scope`。不得编造来源或仅凭链接存在认定方案安全。
- `drugs`：以稳定key索引，每药含 `name`、唯一治疗作用 `role`、`specification`、`dose`、`route`、`frequency`、`timing`、`warnings`、非空 `sourceIds`（sources数组的零基索引），可选 `durationSuffix`。
- `variants`：唯一 `id`、假设情境 `assumption`、`maxAge`、`excludedAllergies` 数组、`medications` 数组（每项 `drug` 为上述key，`days` 为正整数）。每项1～5种，不重复药品或治疗作用。不同情境须有实质处方差异。

## 验证及交付

运行 `scripts/test_fictional_test_mode.mjs` 和 `scripts/test_fictional_workbook.mjs` 检验模式隔离、最低种数、源字段保护、过敏排除、处方去重及实际导出。正式运行后重新打开Excel核验17列、1张表、1个表对象、全部userid顺序、原字段一致、每人达到最少种数、处方对应且内容完整。检查首段、中段、末段预览，确认无裁切和公式错误。

仅交付验证通过的 `*虚构测试.xlsx`，简述记录数、逐人药品数及实质处方去重数量。失败不能用候选评估文件或历史文件冒充新输出。内部情境假设和核验JSON留在工作目录。
