# Medication List Clock Times

The medication list's `用药时间` column and JSON `medicationTime` field use
24-hour `HH:mm` values. Multiple times use an ASCII comma followed by one space.
The requested defaults are `早中晚` -> `08:00, 12:00, 18:00` and
`早晚` -> `08:00, 18:00`. A source's explicit clock times take precedence.

Generate clock times while preparing stage-3 records. Preserve meal timing,
fasting, bedtime, spacing and other administration requirements in precautions;
select compatible times instead of discarding those requirements. Respect
prescribed equal intervals rather than replacing them with meal-time defaults.
These are reminder times, not evidence of actual medication administration.

The existing workbook builder validates clock syntax, valid hours and minutes,
chronological order, uniqueness and the number of times for fixed daily
frequencies or a single administration. It rejects legacy timing phrases instead
of guessing how an ambiguous instruction maps to a patient's schedule.
Both medication-column variants share this contract and keep the existing
nine-column medication-list template.

Verify exported cells by reopening synthetic workbooks. Cover one, two and
three clock times, legacy phrases, invalid clocks, duplicate/out-of-order times
and frequency mismatches. Update the skill contract, reference, version and
matching installed files after validation.
