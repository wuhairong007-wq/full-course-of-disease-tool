# Pharmacology-Only Health Plan Field

The stage-2 `AI药理科普` field explains only each reviewed medication's mechanism and pharmacological effects. Keep one paragraph per medication, beginning with its exact name. Do not require a patient disease name or prescription token.

Exclude prescription specifications, doses, routes, frequencies, timing, duration, administration techniques, execution instructions and monitoring advice from this field. Keep procedure/device explanations in the existing treatment field. The other health-plan fields retain their current contracts.

Update both generation instructions and export validation, including the duplicate checks in the workbook builder. Verify concise mechanism-only text succeeds and prescription instructions fail. Run the existing stage-2 regressions, then synchronize only changed package files to the installed skill, preserving unrelated installed changes.
