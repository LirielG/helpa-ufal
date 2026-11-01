/*
  Warnings:

  - You are about to drop the `ActivityDetails` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[registrationCode]` on the table `Student` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[registrationCode]` on the table `Teacher` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[cndb]` on the table `Teacher` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `campus` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Activity` table without a default value. This is not possible if the table is not empty.
  - Added the required column `district` to the `Address` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "CampusLocation" AS ENUM ('MACEIO', 'ARAPIRACA', 'PALMEIRA', 'PENEDO', 'RIO_LARGO', 'DELMIRO_GOUVEIA', 'SANTANA_IPANEMA');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityType" ADD VALUE 'COURSE';
ALTER TYPE "ActivityType" ADD VALUE 'LECTURE';
ALTER TYPE "ActivityType" ADD VALUE 'OTHER';

-- DropForeignKey
ALTER TABLE "ActivityDetails" DROP CONSTRAINT "ActivityDetails_activityId_fkey";

-- DropForeignKey
ALTER TABLE "ActivityDetails" DROP CONSTRAINT "ActivityDetails_addressId_fkey";

-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "campus" "CampusLocation" NOT NULL,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "slots" SET DEFAULT 1,
ALTER COLUMN "status" SET DEFAULT 'OPEN';

-- AlterTable
ALTER TABLE "Address" ADD COLUMN     "district" TEXT NOT NULL;

-- DropTable
DROP TABLE "ActivityDetails";

-- CreateTable
CREATE TABLE "activity_details" (
    "activityId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "area" TEXT NOT NULL,
    "format" "ActivityFormat" NOT NULL,
    "url" TEXT,
    "workloadHours" INTEGER NOT NULL,
    "addressId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "activity_details_pkey" PRIMARY KEY ("activityId")
);

-- CreateIndex
CREATE INDEX "Activity_status_idx" ON "Activity"("status");

-- CreateIndex
CREATE INDEX "Activity_type_idx" ON "Activity"("type");

-- CreateIndex
CREATE INDEX "Activity_authorId_idx" ON "Activity"("authorId");

-- CreateIndex
CREATE INDEX "Activity_startDate_endDate_idx" ON "Activity"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "Enrollment_userId_idx" ON "Enrollment"("userId");

-- CreateIndex
CREATE INDEX "Enrollment_activityId_idx" ON "Enrollment"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "Student_registrationCode_key" ON "Student"("registrationCode");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_registrationCode_key" ON "Teacher"("registrationCode");

-- CreateIndex
CREATE UNIQUE INDEX "Teacher_cndb_key" ON "Teacher"("cndb");

-- AddForeignKey
ALTER TABLE "activity_details" ADD CONSTRAINT "activity_details_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "activity_details" ADD CONSTRAINT "activity_details_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address"("id") ON DELETE SET NULL ON UPDATE CASCADE;
