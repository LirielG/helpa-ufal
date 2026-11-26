-- DropIndex
DROP INDEX "UserCode_tokenHash_key";

-- AlterTable
ALTER TABLE "UserCode" ADD COLUMN     "failedAttempts" INTEGER NOT NULL DEFAULT 0;
