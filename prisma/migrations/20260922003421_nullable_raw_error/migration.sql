-- Some events have a non-null error_analysis (real error_severity/is_blunder/
-- luck values) but a null raw_error — analysis_level: 1, error_severity:
-- "doubtful", event_type "dice_rolled" paired with analysed_event
-- "cube_double" — a partial/low-confidence analysis that grades severity
-- without a computed equity-error magnitude (confirmed against real data,
-- match 32699544 — see docs/field-mapping.md). Previously rawError was a
-- required Float, so this shape failed prisma.decision.upsert() outright.
ALTER TABLE `Decision` MODIFY `rawError` DOUBLE NULL;
