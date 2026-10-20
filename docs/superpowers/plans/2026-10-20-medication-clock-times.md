# Medication List Clock Times Implementation Plan

**Goal:** Generate concrete `HH:mm` medication times in stage-3 medication lists.

**Architecture:** Keep record generation responsible for selecting times and
preserving administration requirements. Validate the field in the existing
builder before exporting either workbook.

**Tech Stack:** Node.js, node:assert/strict, existing artifact-tool workbook tests.

- [x] Update `scripts/test_medication_tracking_workbooks.mjs` and
  `scripts/test_manufacturer_medication_workflow.mjs` with clock-time records,
  reopened-cell assertions and invalid-time cases. Run the tracking test and
  confirm the current builder rejects valid clock times.
- [x] Update `scripts/build_medication_tracking_workbooks.mjs` to require
  zero-padded valid clocks separated by `, `, unique ascending values, and the
  matching number of times for `每日N次` and `单次`.
- [x] Update `SKILL.md` stage 3 and stop conditions, plus
  `references/medication-tracking-schema.md`, with examples and preservation of
  meal/spacing requirements. Increment the patch version.
- [x] Run `node scripts/test_medication_tracking_workbooks.mjs`,
  `node scripts/test_manufacturer_medication_workflow.mjs`, the medication
  confirmation/specification/wording tests, and `node scripts/validate_skill.mjs`.
- [x] Synchronize only changed package files to the identical installed skill;
  verify the installed package and exact file equality.
