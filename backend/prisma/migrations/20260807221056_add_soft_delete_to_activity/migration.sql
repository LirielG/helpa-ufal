-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "deletedAt" TIMESTAMP(3);

CREATE INDEX "activity_active_status_startdate_idx" -- Added manually
  ON "Activity" ("status", "startDate")
  WHERE "deletedAt" IS NULL;
