# Disease-Consistent Simulated Outpatient Summaries

## Scope

Change only stage-2 `aiMedicalRecord` generation. The user's request authorizes typical simulated consultation information based on `disease` and `coursePlanName`. Preserve the six labels, eleven JSON keys, thirteen workbook columns, source order, activation date and status values. Do not introduce simulation disclaimers inside clinical cells.

## Approach

Use the existing stage-1 mode names: the stage-2 skill trigger selects `--mode fictional-test` for the medical summary by default, while an explicit real-evidence/no-simulation request selects `--mode real`. Direct builder calls default to real for backwards compatibility. Simulated exports require `模拟` or `虚构测试` in the filename. No template or schema columns change.

Compared with removing all evidence safeguards, a field-scoped mode preserves real-data boundaries. Compared with hard-coded disease templates, model-authored scenarios support the full disease range without forcing unrelated symptoms or procedures onto patients.

## Generation Contract

- Read disease and full-course plan together, establish anatomy and treatment phase, and author a typical complaint with duration, relevant examination findings and a concrete disposition.
- Simulated observations must not override supplied facts, allergies or treatments. Do not propagate invented findings into pharmacology, treatment plans, monitoring baselines or downstream evidence.
- The default simulated hypertension presentation uses elevated BP, not a normal-BP template. This is a scenario constraint requested by the user, not a claim that all actual treated hypertensive patients have elevated BP.
- Postoperative plans describe postoperative follow-up, not a contradictory not-yet-operated history. The abdominal-surgery example is a style example, never a universal intervention.
- Real mode retains prospective interview/examination prompts because the fixed reviewed-input contract contains no actual complaint or examination columns.

## Validation

Extend the existing medical-record content validator with optional patient/mode context. The builder passes this context. Enforce six nonempty sections, actual-style simulated content, duration, relevant findings, disease context in disposition, simulated BP consistency and obvious postoperative-phase contradictions. Preserve the existing prohibition on meta-commentary and separate full-course-plan labels.

Deterministic checks catch selected known conflicts, not general clinical correctness. The generation workflow must separately review disease/plan, complaint/signs, and disposition/phase consistency for every patient, consulting authoritative clinical sources when uncertain.

## Verification And Delivery

Add failing unit cases before implementation and workbook integration cases for simulation, filename/mode guards and legacy real behavior. Run the stage-2 suites and package validation, then sync the canonical skill to the installed directory. Do not commit patient artifacts or automatically commit/push this new change.
