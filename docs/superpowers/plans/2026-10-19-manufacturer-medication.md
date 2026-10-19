# Manufacturer Medication Implementation

1. Add failing tests for alias headers and product-only policy.
2. Implement shared header normalization and medication-scope validation.
3. Integrate stage-1 extraction, real export and fictional generation.
4. Integrate downstream extractors and builders, preserving tracking headers.
5. Update skill contracts and run focused and regression tests.
6. Synchronize changed resources to the active installed skill.

## Completed Validation

All implementation steps are complete. The active skill is version 1.2.23;
30 changed skill resources were synchronized and byte-compared with source.

- New workflow tests pass for real and fictional product-only export,
  company precedence, allergy and device rejection, incompatible minimums,
  16/17/18-column downstream extraction, tracking/table header metadata,
  single-drug medication rows, adverse-product exclusion and source preservation.
- Existing patient-detail, review, output-contract, company/device, symptom,
  fictional, health-plan, tracking and adverse-reaction workbook suites pass.
- Shared medication, allergy, specification, review, timing, selector and
  insight/interview parser tests pass.
- Insight extraction: 10 tests and 6 subtests pass, including new patient and
  tracking header compatibility.
- Canonical and installed package validation and quick skill validation pass;
  `git diff --check` passes.

## Version 1.2.25 Synchronization

The active version 1.2.25 adds the revised health-plan headers, six labeled
medical-summary sections, and a 15-column manufacturer tracking workbook with
four required medication-precaution sections. These changes and the updated
health-plan template are synchronized into the repository.

Preserve the repository's additional age/gender eligibility checks and rejection
of ambiguous manufacturer prescriptions. Merge the workflow tests with the
15-column tracking assertions, and resolve test resources relative to the
package directory. Synchronize the merged resources back to the installed skill.
