-- 1. new field
ALTER TABLE "Enrollment" ADD COLUMN "confirmedWorkloadHours" INTEGER NOT NULL DEFAULT 0;

-- 2. Loosens the existing column
ALTER TABLE "Enrollment" ALTER COLUMN "attendanceConfirmed" DROP NOT NULL;

-- 3.Converts history: the old `false` meant "nothing said," not "missing."
UPDATE "Enrollment" SET "attendanceConfirmed" = NULL WHERE "attendanceConfirmed" = false;

-- 4. Remove the default: a new registration starts with "nothing specified"
ALTER TABLE "Enrollment" ALTER COLUMN "attendanceConfirmed" DROP DEFAULT;