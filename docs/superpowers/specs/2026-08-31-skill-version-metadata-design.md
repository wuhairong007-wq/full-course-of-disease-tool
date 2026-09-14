# Skill Version Metadata Design

## Goal

Expose a clear semantic version so users can determine whether an installed `generating-patient-full-course-data` skill matches the latest GitHub version.

## Version Source

Use `metadata.version` in `SKILL.md` frontmatter as the single source of truth:

```yaml
metadata:
  version: "1.0.0"
```

Start at `1.0.0`. Increase the minor version when generation rules or supported behavior change, and increase the patch version for compatible fixes that do not change the skill contract. Reserve a major-version increase for incompatible trigger, input, or output contract changes.

Apply the same version metadata to the active skill directory and the GitHub repository copy. Verify both skill directories are identical after synchronization.

## Validation

Extend `scripts/validate_skill.mjs` to require the metadata block and enforce a three-part semantic version containing non-negative integers. The validation must fail when the version is missing or malformed.

## User Check

Update `README.md` with a command that reads `metadata.version` from the installed `SKILL.md`. Users compare that value with the version shown in the GitHub `SKILL.md` frontmatter.

## Testing

Modify the package validation expectation before adding the version metadata, confirm the validation fails because the version is absent, then add `metadata.version: "1.0.0"` and confirm validation passes. Run `git diff --check` and the existing skill validation after the change.

## Scope

Only `SKILL.md` and `scripts/validate_skill.mjs` change in both skill copies, plus `README.md` in the GitHub repository. Generation rules, templates, workbook schemas, and clinical behavior remain unchanged.
