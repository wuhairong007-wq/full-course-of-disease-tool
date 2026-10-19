# Patient Full-Course Disease Tool

Codex skill for generating template-matched patient full-course Excel workbooks.

## Install with Codex

Ask Codex:

```text
Install the generating-patient-full-course-data skill from
https://github.com/wuhairong007-wq/full-course-of-disease-tool/tree/main/generating-patient-full-course-data
```

The skill is installed into `~/.codex/skills/generating-patient-full-course-data` and becomes available on the next turn.

## Check Installed Version

Read the installed semantic version:

```bash
sed -n 's/^  version: "\(.*\)"/\1/p' ~/.codex/skills/generating-patient-full-course-data/SKILL.md
```

Compare it with `metadata.version` in the latest GitHub `SKILL.md`. Reinstall the skill when the installed value is lower.

## Supported Triggers

```text
生成患者明细 依据文件：<Excel路径>
生成健康管理方案 依据文件：<Excel路径>
生成跟踪提醒和用药清单 依据文件：<Excel路径> 服务周期 YYYY-MM-DD 至 YYYY-MM-DD
生成不良反应清单 依据文件：<Excel路径> 数量：N
```

Do not commit generated patient workbooks or source patient data to this repository.

Patient medication columns also support `关联厂家用药` in place of `联合用药`.
This explicit scope keeps only the current medicinal product and one matching
prescription, defaults to one medication, and preserves the new heading in
patient-detail exports. Tracking exports omit the medication column and use
15 columns; medication-list precautions include separate diet, co-medication,
observation, and storage sections. A requested minimum above one conflicts with
this scope. All later stages accept either input heading; ordinary combined
medication behavior and safety checks remain unchanged.

Health-management exports use `门诊病历摘要` and `关联产品临床应用方案`.
Medical summaries contain six labeled sections; missing complaint or examination
facts are expressed as prospective interview or examination prompts.
