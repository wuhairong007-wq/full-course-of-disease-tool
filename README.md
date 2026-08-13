# Patient Full-Course Disease Tool

Codex skill for generating template-matched patient full-course Excel workbooks.

## Install with Codex

Ask Codex:

```text
Install the generating-patient-full-course-data skill from
https://github.com/wuhairong007-wq/full-course-of-disease-tool/tree/main/generating-patient-full-course-data
```

The skill is installed into `~/.codex/skills/generating-patient-full-course-data` and becomes available on the next turn.

## Supported Triggers

```text
生成患者明细 依据文件：<Excel路径>
生成健康管理方案 依据文件：<Excel路径>
生成跟踪提醒和用药清单 依据文件：<Excel路径> 服务周期 YYYY-MM-DD 至 YYYY-MM-DD
生成不良反应清单 依据文件：<Excel路径> 数量：N
```

Do not commit generated patient workbooks or source patient data to this repository.
