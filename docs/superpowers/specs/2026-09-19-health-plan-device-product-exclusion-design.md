# Health Plan Device Product Exclusion Design

## Goal

Limit the rule that forbids the current product name in `治疗方案梳理` to device patients. Medication products may appear there when they are part of the reviewed combined-medication list.

## Detection

The reviewed patient-detail workbook does not retain `产品类型`. Treat a patient as a device patient when `耗材名称` is non-empty in the current 16/18-column schema. For the legacy 17-column schema, use a non-empty `手术名称` as the compatible device signal.

## Validation

- Device patient: reject the explicit `--product` value in `治疗方案梳理`.
- Medication patient: do not apply the product-name exclusion; retain the existing requirement that every reviewed combined medication appears in `治疗方案梳理`.
- Keep the existing `AI健康管理师介绍` product-name exclusion unchanged.

## Verification

Add workbook-level regression cases for a medication product that is allowed in `治疗方案梳理` and a device product that remains rejected. Run the health-plan workbook tests and the skill validator, then synchronize the repository skill to the installed Codex skill directory.
