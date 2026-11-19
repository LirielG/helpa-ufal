import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { prisma } from "@/database/prisma.js";

const MIGRATION_PATH = resolve(
  import.meta.dirname,
  "../../../prisma/migrations/20261119172600_add_moderation_decisions/migration.sql",
);

describe("20261119172600_add_moderation_decisions data migration", () => {
  it("converts existing resolved reports into one REJECTED decision per activity while keeping open reports open", async () => {
    const schema = "moderation_migration_test";
    const migrationSql = readFileSync(MIGRATION_PATH, "utf8");

    try {
      await prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
        await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
        await tx.$executeRawUnsafe(
          `SET LOCAL search_path TO "${schema}", pg_catalog`,
        );

        // Recreate the minimal pre-migration tables involved in the migration.
        await tx.$executeRawUnsafe(`
          CREATE TYPE "ReportReason" AS ENUM ('SPAM', 'INAPPROPRIATE_CONTENT', 'MISINFORMATION', 'DUPLICATE', 'OTHER');
          CREATE TABLE "User" ("id" TEXT NOT NULL PRIMARY KEY);
          CREATE TABLE "Activity" ("id" TEXT NOT NULL PRIMARY KEY);
          CREATE TABLE "ActivityReport" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "activityId" TEXT NOT NULL,
            "userId" TEXT,
            "category" "ReportReason" NOT NULL,
            "description" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "resolvedAt" TIMESTAMP(3),
            "resolvedById" TEXT,
            CONSTRAINT "ActivityReport_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "ActivityReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
            CONSTRAINT "ActivityReport_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE
          );
        `);

        // Seed pre-migration state:
        // - act-1: 2 resolved reports (different managers/timestamps) + 1 open report
        // - act-2: 1 resolved report whose resolver user was deleted (resolvedById NULL)
        // - act-3: only open report (no decision should be created)
        await tx.$executeRawUnsafe(`
          INSERT INTO "User" ("id") VALUES ('manager-old'), ('manager-new');
          INSERT INTO "Activity" ("id") VALUES ('act-1'), ('act-2'), ('act-3');
          INSERT INTO "ActivityReport" ("id", "activityId", "category", "resolvedAt", "resolvedById") VALUES
            ('rep-1a', 'act-1', 'SPAM', '2026-06-01 10:00:00', 'manager-old'),
            ('rep-1b', 'act-1', 'OTHER', '2026-06-05 15:30:00', 'manager-new'),
            ('rep-1-open', 'act-1', 'MISINFORMATION', NULL, NULL),
            ('rep-2a', 'act-2', 'SPAM', '2026-06-02 09:00:00', NULL),
            ('rep-3-open', 'act-3', 'DUPLICATE', NULL, NULL);
        `);

        // Execute the exact statements from the migration file.
        const statements = migrationSql
          .split(";")
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
        for (const stmt of statements) {
          await tx.$executeRawUnsafe(stmt);
        }

        const decisions = await tx.$queryRawUnsafe<
          {
            id: string;
            activityId: string;
            verdict: string;
            justification: string;
            decidedById: string | null;
            createdAt: Date;
          }[]
        >(
          `SELECT "id", "activityId", "verdict"::text AS "verdict", "justification", "decidedById", "createdAt"
           FROM "ModerationDecision"
           ORDER BY "activityId" ASC`,
        );

        expect(decisions).toHaveLength(2);
        expect(decisions[0]).toMatchObject({
          activityId: "act-1",
          verdict: "REJECTED",
          justification: "Resolvida antes do registro de veredito.",
          decidedById: "manager-new",
        });
        expect(decisions[0]!.createdAt.toISOString()).toBe(
          "2026-06-05T15:30:00.000Z",
        );

        expect(decisions[1]).toMatchObject({
          activityId: "act-2",
          verdict: "REJECTED",
          justification: "Resolvida antes do registro de veredito.",
          decidedById: null,
        });
        expect(decisions[1]!.createdAt.toISOString()).toBe(
          "2026-06-02T09:00:00.000Z",
        );

        const reports = await tx.$queryRawUnsafe<
          { id: string; decisionId: string | null }[]
        >(
          `SELECT "id", "decisionId" FROM "ActivityReport" ORDER BY "id" COLLATE "C" ASC`,
        );

        expect(reports).toEqual([
          { id: "rep-1-open", decisionId: null },
          { id: "rep-1a", decisionId: decisions[0]!.id },
          { id: "rep-1b", decisionId: decisions[0]!.id },
          { id: "rep-2a", decisionId: decisions[1]!.id },
          { id: "rep-3-open", decisionId: null },
        ]);

        // Confirm legacy columns were dropped.
        const remainingLegacyCols = await tx.$queryRawUnsafe<
          { column_name: string }[]
        >(
          `SELECT column_name
           FROM information_schema.columns
           WHERE table_schema = '${schema}'
             AND table_name = 'ActivityReport'
             AND column_name IN ('resolvedAt', 'resolvedById')`,
        );
        expect(remainingLegacyCols).toEqual([]);
      });
    } finally {
      await prisma.$executeRawUnsafe(
        `DROP SCHEMA IF EXISTS "${schema}" CASCADE`,
      );
    }
  });
});
