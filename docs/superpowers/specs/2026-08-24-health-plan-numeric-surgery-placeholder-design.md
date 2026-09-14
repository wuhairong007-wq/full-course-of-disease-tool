# Health Plan Numeric Surgery Placeholder Design

## Problem

The reviewed workbook can contain a numeric-only placeholder such as `29` in `手术名称`. Stage 2 currently treats every non-empty value as a reviewed procedure, so generated treatment and pharmacology text can contain `• 29` and `29：...`.

## Options

1. Filter only during AI generation. This is fragile because the workbook builder still accepts the invalid value.
2. Reject the entire workbook when a numeric placeholder appears. This prevents unsafe output but blocks otherwise usable records.
3. Normalize numeric-only surgery values to an empty string in both extraction and workbook construction. This preserves valid surgery names and prevents invalid generated items. This is the selected approach.

## Design

Create one shared surgery-name normalizer. Trim the source value and return an empty string when the entire value consists only of digits; otherwise preserve the reviewed text unchanged. Use it when extracting Stage 2 patient JSON and when rebuilding the patient context used for final validation.

Add a regression case where a non-surgical patient has `手术名称=29`. The extractor must emit an empty surgery name, the builder must accept records that omit `29`, and the final workbook must not contain a numeric treatment item. Document this normalization rule in the Stage 2 schema and validate that the skill package includes it.

## Scope

This change affects only Stage 2 health-management-plan generation. It does not alter the source workbook or valid surgery names.
