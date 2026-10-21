# Patient Output Wording Implementation Plan

**Goal:** Apply the three requested content restrictions to patient details and
health-management plans.

**Architecture:** Keep the existing record and workbook contracts. Add a
prescription-content validator at stage-1 export and catalog generation, extend
the existing product-name and health-plan validators, and align the skill text.

**Tech Stack:** Node.js ES modules, node:assert, artifact-tool.

- [x] Add failing cases for prescription warnings, fictional warning leakage,
  product names with test markers, and health-plan meta-commentary.
- [x] Remove catalog warnings from rendered prescriptions, reject prescription
  safety/explanation text, and retain internal warnings.
- [x] Reject current-product names with test markers removed in plan names.
- [x] Accept plain prospective medical-record prompts, reject meta-commentary
  across all health-plan content fields, and update fixtures.
- [x] Align the entrypoint, relevant references and metadata; increase the patch
  version to 1.2.27.
- [x] Run focused validators, stage-1/stage-2 workbook tests and package
  validation; synchronize changed files to the installed skill and verify parity.
