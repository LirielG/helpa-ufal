-- Partial index covering only open reports for the moderation queue
-- (ORDER BY MAX(createdAt) DESC) and the NOT EXISTS check in decided.
CREATE INDEX "ActivityReport_open_activityId_createdAt_idx"
  ON "ActivityReport"("activityId", "createdAt" DESC)
  WHERE "decisionId" IS NULL;

-- Enforce non-empty, bounded justification at the database level as well.
ALTER TABLE "ModerationDecision"
  ADD CONSTRAINT "ModerationDecision_justification_length_check"
  CHECK (char_length(btrim("justification")) BETWEEN 1 AND 500);
