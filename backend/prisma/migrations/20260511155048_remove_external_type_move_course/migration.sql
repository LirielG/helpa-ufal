/*
  Warnings:

  - The values [EXTERNAL] on the enum `UserType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `course` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `External` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `course` to the `Student` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "UserType_new" AS ENUM ('STUDENT', 'TEACHER');
ALTER TABLE "User" ALTER COLUMN "userType" TYPE "UserType_new" USING ("userType"::text::"UserType_new");
ALTER TYPE "UserType" RENAME TO "UserType_old";
ALTER TYPE "UserType_new" RENAME TO "UserType";
DROP TYPE "public"."UserType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "External" DROP CONSTRAINT "External_userId_fkey";

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "course" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Teacher" ADD COLUMN     "course" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "course";

-- DropTable
DROP TABLE "External";
