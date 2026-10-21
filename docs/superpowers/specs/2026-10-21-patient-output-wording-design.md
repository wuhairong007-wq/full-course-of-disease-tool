# Patient Output Wording

The patient's prescription list contains only medication name, specification,
dose, route and administration method, frequency, timing, and concrete duration.
Warnings, contraindications, interactions, monitoring, allergy explanations,
efficacy descriptions, and care-seeking advice stay in internal reviews or the
existing health-plan and medication-list safety fields. Existing company-specific
consumable segments retain their separate contract.

Real exports validate this boundary; fictional generation no longer appends
catalog warnings. The catalog retains warnings for internal safety review.

Course-plan names retain the disease and phase and exclude the current product,
including the product name without its trailing test marker.

Health-plan content excludes `辅助对症`, `非患者已报告症状`,
`非已观察结果`, and equivalent meta-commentary. Missing clinical observations
remain prospective `门诊拟询问` and `门诊拟检查` prompts, with no disclaimer
parentheses and no invented observations.

Verify the changes with focused unit and workbook tests, then synchronize the
changed package files into the installed Codex skill. Do not change historical
workbooks, templates, or the stale top-level skill copy.
