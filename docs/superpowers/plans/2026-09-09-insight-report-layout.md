# 洞察报告版式增强 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为洞察报告增加参考文档式封面、动态目录、正文页码，更新六维雷达图样式并移除图表说明段。

**Architecture:** 请求解析器携带可选封面元数据；数据提取器把服务地区写入 insight JSON；Word 构建器负责封面、目录分节和页码；图表脚本负责雷达图；校验器和测试覆盖结构与版式契约。

**Tech Stack:** Python 3、python-docx、matplotlib、lxml、LibreOffice 渲染器、Node.js 请求解析测试。

---

### Task 1: Extend insight request metadata

**Files:**
- Modify: `generating-patient-full-course-data/scripts/insight_request_parser.mjs`
- Modify: `generating-patient-full-course-data/scripts/extract_insight_sources.py`
- Modify: `generating-patient-full-course-data/SKILL.md`
- Test: `generating-patient-full-course-data/scripts/test_insight_request_parser.mjs`

- [ ] Add optional `委托方` and `服务商` lines to the parsed request object.
- [ ] Pass those values to extraction and store them in `insight.metadata`; compute a readable service-region summary from patient region labels.
- [ ] Add trigger examples and optional-field behavior to the skill instructions.
- [ ] Add parser assertions for present and absent optional values.

### Task 2: Add cover, TOC, body page numbering, and remove chart explanation

**Files:**
- Modify: `generating-patient-full-course-data/scripts/build_insight_report.py`
- Modify: `generating-patient-full-course-data/references/insight-report-template-contract.md`

- [ ] Add a first-page cover table populated only from insight metadata and current date.
- [ ] Add a dynamic TOC field after the cover and begin the report body in a new section with page numbering restarted at 1.
- [ ] Assign Heading 1-3 styles to generated headings so the TOC includes all required levels.
- [ ] Keep figure captions and remove the `图表说明` paragraph.

### Task 3: Match the six-dimension radar chart style

**Files:**
- Modify: `generating-patient-full-course-data/scripts/generate_insight_charts.py`
- Test: `generating-patient-full-course-data/scripts/test_generate_insight_charts.py`

- [ ] Render the symptom chart with a 0-5 polar scale, black outer spine, gray rings, blue filled polygon, markers, concise labels, and an in-chart title.
- [ ] Add a regression assertion that the symptom PNG is non-empty and has the expected raster dimensions.

### Task 4: Strengthen report validation and regression coverage

**Files:**
- Modify: `generating-patient-full-course-data/scripts/validate_insight_report.py`
- Add/modify: `generating-patient-full-course-data/scripts/test_validate_insight_report.py`

- [ ] Validate cover fields, a TOC field, a body PAGE field, absence of `图表说明：`, and existing nine-chapter/data-reconciliation rules.
- [ ] Run parser, chart, report-builder, validator, and document render checks against representative fixtures.

