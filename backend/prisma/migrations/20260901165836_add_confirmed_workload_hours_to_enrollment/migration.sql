-- 1. Novo campo
ALTER TABLE "Enrollment" ADD COLUMN "confirmedWorkloadHours" INTEGER NOT NULL DEFAULT 0;

-- 2. Afrouxa a coluna existente
ALTER TABLE "Enrollment" ALTER COLUMN "attendanceConfirmed" DROP NOT NULL;

-- 3. Converte o histórico: o `false` antigo significava "nada dito", não "faltou"
UPDATE "Enrollment" SET "attendanceConfirmed" = NULL WHERE "attendanceConfirmed" = false;

-- 4. Remove o default: inscrição nova nasce com "nada dito"
ALTER TABLE "Enrollment" ALTER COLUMN "attendanceConfirmed" DROP DEFAULT;