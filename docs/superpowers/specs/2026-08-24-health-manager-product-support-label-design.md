# Health Manager Product-Support Label Design

## Problem

`AI健康管理师介绍` can contain a mechanical parenthetical label such as `（注射用胰蛋白酶支持）`. The label is not natural patient-facing language and duplicates medication information that belongs in the reviewed treatment and pharmacology fields.

## Options

1. Add only a prompt rule. This reduces occurrence but cannot prevent noncompliant records from reaching Excel.
2. Add only a builder validation rule. This protects output but wastes generation work before failing.
3. Add the prompt rule and builder validation together. This is the selected approach because it guides generation and enforces the final contract.

## Design

In the Stage 2 schema, prohibit parenthetical labels whose content is an exact reviewed medication name followed by `支持`, using either Chinese or ASCII parentheses. Allow natural prose such as `为您提供用药管理支持` because it is not a product-name label.

In `validateManagerIntro`, escape every reviewed medication name and reject `（药品名称支持）` or `(药品名称支持)`. Add a regression record using `（华法林钠片支持）` and require the builder to stop with a clear AI health-manager introduction error.

## Scope

Only `AI健康管理师介绍` changes. Medication names remain required in treatment-plan and pharmacology fields.
