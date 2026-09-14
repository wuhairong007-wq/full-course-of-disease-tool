# Osteoarthritis Symptom Stratification Design

## Goal

Generate clinically bounded osteoarthritis regimens from the user's authorized simulated pain and inflammation strata when the source workbook has no symptom-detail fields.

## Design

Use `userid + disease` as a stable key to choose one of three strata: mild pain without inflammatory features, moderate pain with inflammatory features, or severe persistent pain with inflammatory features. The selected stratum is an internal generation input and is not written as a source-derived patient fact.

Every regimen retains the supplied `硫酸氨基葡萄糖胶囊` first. Moderate strata add `双氯芬酸二乙胺乳胶剂`. Severe strata add both that topical medicine and `对乙酰氨基酚片`. A documented NSAID allergy removes the topical NSAID role; the severe stratum may retain the acetaminophen role. Existing allergy, medication-order, specification, and one-prescription-per-medication validators remain authoritative.

## Verification

The selector test must prove stable selection, each of the three role sets, and the NSAID-allergy downgrade. The regenerated workbook must contain 1-3 medication items per patient, retain all 1,498 source patients in order, pass the builder checks, and show a non-uniform regimen distribution.
