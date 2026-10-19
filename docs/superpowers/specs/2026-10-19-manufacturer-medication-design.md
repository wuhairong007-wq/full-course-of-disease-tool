# Manufacturer Medication Column

Recognize `关联厂家用药` as a semantic variant of `联合用药`. Only an
explicit manufacturer header activates the variant; ordinary inputs remain
unchanged. Keep internal `combinedMedication` records compatible.

For stage 1, manufacturer medication is exactly the row's medicinal
`产品名称`, with one matching complete prescription. Its effective minimum is
one; reject a supplied minimum greater than one. This explicit product-only
scope overrides company product exclusion and combination/diversity expansion,
but never allergy, indication, specification, source-fact or prescription checks.
Reject device products rather than treating a consumable as a medication.
Reject both medication headers in one input because the selected scope would
be ambiguous.

Preserve the selected header in stage-1 output and stage-3 tracking output,
including the Excel table metadata. Stages 2-4 accept either header in all
supported 16/17/18-column patient layouts, enforce a single medication for the
manufacturer variant, and retain existing JSON contracts. Stages 5-6 accept
these workbooks without changing report template headings or inventing drugs.

Update the canonical repository and install the same changed skill resources
into the active skill folder. Do not modify the stale workspace copy.

## Version 1.2.25 Updates

Patient details retain the selected medication header. For manufacturer inputs,
tracking exports omit the medication column and contain exactly 15 columns.
Medication-list precautions require separate nonempty diet, co-medication,
observation, and storage sections.

Health-plan exports use `门诊病历摘要` and `关联产品临床应用方案`.
Medical summaries require department, visit date, chief complaint, examination,
disposition, and follow-up labels. Where complaint or examination facts are
absent, clearly prospective prompts must distinguish them from observed facts.
