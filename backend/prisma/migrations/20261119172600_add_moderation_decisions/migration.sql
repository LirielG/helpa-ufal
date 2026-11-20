-- CreateEnum
CREATE TYPE "ModerationVerdict" AS ENUM ('UPHELD', 'REJECTED');

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN "removedByModerationAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ModerationDecision" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "verdict" "ModerationVerdict" NOT NULL,
    "justification" TEXT NOT NULL,
    "decidedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationDecision_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ActivityReport" ADD COLUMN "decisionId" TEXT;

-- Migrate existing resolved reports into one REJECTED decision per activity,
-- preserving the most recent resolution's resolver and timestamp.
WITH latest_resolutions AS (
    SELECT DISTINCT ON ("activityId")
        gen_random_uuid()::text AS "decisionId",
        "activityId",
        "resolvedById",
        "resolvedAt"
    FROM "ActivityReport"
    WHERE "resolvedAt" IS NOT NULL
    ORDER BY "activityId", "resolvedAt" DESC, "id" ASC
),
inserted_decisions AS (
    INSERT INTO "ModerationDecision" ("id", "activityId", "verdict", "justification", "decidedById", "createdAt")
    SELECT
        "decisionId",
        "activityId",
        'REJECTED'::"ModerationVerdict",
        'Resolvida antes do registro de veredito.',
        "resolvedById",
        "resolvedAt"
    FROM latest_resolutions
    RETURNING "id", "activityId"
)
UPDATE "ActivityReport" ar
SET "decisionId" = d."id"
FROM inserted_decisions d
WHERE ar."activityId" = d."activityId"
  AND ar."resolvedAt" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "ActivityReport" DROP CONSTRAINT "ActivityReport_resolvedById_fkey";

-- AlterTable
ALTER TABLE "ActivityReport" DROP COLUMN "resolvedAt",
DROP COLUMN "resolvedById";

-- CreateIndex
CREATE INDEX "ModerationDecision_activityId_createdAt_idx" ON "ModerationDecision"("activityId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityReport_activityId_decisionId_idx" ON "ActivityReport"("activityId", "decisionId");

-- CreateIndex
CREATE INDEX "ActivityReport_decisionId_idx" ON "ActivityReport"("decisionId");

-- AddForeignKey
ALTER TABLE "ModerationDecision" ADD CONSTRAINT "ModerationDecision_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationDecision" ADD CONSTRAINT "ModerationDecision_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityReport" ADD CONSTRAINT "ActivityReport_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "ModerationDecision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
