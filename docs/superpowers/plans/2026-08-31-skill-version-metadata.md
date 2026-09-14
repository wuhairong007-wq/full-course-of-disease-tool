# Skill Version Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a validated `1.0.0` semantic version to the active patient full-course skill and its GitHub repository copy so users can identify outdated installations.

**Architecture:** Store the version once in each synchronized `SKILL.md` frontmatter under `metadata.version`. Extend the package validator to enforce the exact metadata shape and semantic-version syntax, then document a read-only installed-version command in the repository README.

**Tech Stack:** Markdown, YAML frontmatter, Node.js ESM, built-in `node:assert`, Git.

---

### Task 1: Add a failing version validation

**Files:**
- Modify: `/Users/a11/Sites/Java/JKZL/skills/generating-patient-full-course-data/scripts/validate_skill.mjs:49`
- Test: `/Users/a11/Sites/Java/JKZL/skills/generating-patient-full-course-data/scripts/validate_skill.mjs`

- [ ] **Step 1: Require metadata and semantic-version syntax**

Replace the existing frontmatter assertion with:

```js
assert.match(skill, /^---\nname: generating-patient-full-course-data\ndescription: .+\nmetadata:\n  version: "[^"]+"\n---\n/);
const version = skill.match(/^  version: "([^"]+)"$/m)?.[1];
assert(version, "SKILL.md必须声明metadata.version");
assert.match(version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, "metadata.version必须使用x.y.z语义化版本");
```

- [ ] **Step 2: Run validation and verify RED**

Run:

```bash
/Users/a11/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/validate_skill.mjs
```

Expected: FAIL because the current `SKILL.md` has no `metadata.version` block.

### Task 2: Add version metadata and synchronize

**Files:**
- Modify: `/Users/a11/Sites/Java/JKZL/skills/generating-patient-full-course-data/SKILL.md:1`
- Modify: `/Users/a11/Sites/Java/JKZL/skills/full-course-of-disease-tool/generating-patient-full-course-data/SKILL.md:1`
- Modify: `/Users/a11/Sites/Java/JKZL/skills/full-course-of-disease-tool/generating-patient-full-course-data/scripts/validate_skill.mjs:49`

- [ ] **Step 1: Add the initial version to the active skill**

Set the frontmatter to:

```yaml
---
name: generating-patient-full-course-data
description: Use when a user provides an Excel file and asks to generate 患者明细、患者全病程数据、出院后个性化医疗记录、联合用药、处方清单、器械匹配手术名称、全病程方案、健康管理方案、跟踪提醒、用药清单或不良反应清单, including “生成患者明细 依据文件：Excel路径”, “生成健康管理方案 依据文件：Excel路径”, “生成跟踪提醒和用药清单 依据文件：Excel路径 服务周期 YYYY-MM-DD 至 YYYY-MM-DD”, and “生成不良反应清单 依据文件：Excel路径 数量：N”.
metadata:
  version: "1.0.0"
---
```

- [ ] **Step 2: Run active-skill validation and verify GREEN**

Run the validation command from Task 1 in the active skill directory.

Expected: `{"status":"passed","skill":"generating-patient-full-course-data","files":39}`.

- [ ] **Step 3: Apply the same metadata and validator changes to the repository copy**

Make the repository `SKILL.md` and `scripts/validate_skill.mjs` byte-for-byte identical to the active skill versions.

- [ ] **Step 4: Verify both skill copies match**

Run:

```bash
diff -qr --exclude='.DS_Store' --exclude='.git' full-course-of-disease-tool/generating-patient-full-course-data generating-patient-full-course-data
```

Expected: exit code `0` with no output.

### Task 3: Document version comparison

**Files:**
- Modify: `/Users/a11/Sites/Java/JKZL/skills/full-course-of-disease-tool/README.md`

- [ ] **Step 1: Add installed-version instructions**

Add this section after installation instructions:

````markdown
## Check Installed Version

Read the installed semantic version:

```bash
sed -n 's/^  version: "\(.*\)"/\1/p' ~/.codex/skills/generating-patient-full-course-data/SKILL.md
```

Compare it with `metadata.version` in the latest GitHub `SKILL.md`. Reinstall the skill when the installed value is lower.
````

- [ ] **Step 2: Verify README and frontmatter consistency**

Run:

```bash
rg -n 'metadata.version|Check Installed Version|version: "1.0.0"' README.md generating-patient-full-course-data/SKILL.md
```

Expected: README contains the comparison instructions and `SKILL.md` contains `version: "1.0.0"`.

### Task 4: Final verification

**Files:**
- Verify: `/Users/a11/Sites/Java/JKZL/skills/full-course-of-disease-tool/generating-patient-full-course-data/SKILL.md`
- Verify: `/Users/a11/Sites/Java/JKZL/skills/full-course-of-disease-tool/generating-patient-full-course-data/scripts/validate_skill.mjs`
- Verify: `/Users/a11/Sites/Java/JKZL/skills/full-course-of-disease-tool/README.md`

- [ ] **Step 1: Run repository package validation**

Run the validation command from Task 1 in `full-course-of-disease-tool/generating-patient-full-course-data`.

Expected: `{"status":"passed","skill":"generating-patient-full-course-data","files":39}`.

- [ ] **Step 2: Check patch quality and scope**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; tracked changes are limited to the planned skill, validator, and README files. Existing unrelated untracked documents remain unstaged.
