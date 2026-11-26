-- CreateEnum
CREATE TYPE "UserCodeType" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');

-- CreateTable
CREATE TABLE "UserCode" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "UserCodeType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCode_tokenHash_key" ON "UserCode"("tokenHash");

-- CreateIndex
CREATE UNIQUE INDEX "UserCode_userId_type_key" ON "UserCode"("userId", "type");

-- AddForeignKey
ALTER TABLE "UserCode" ADD CONSTRAINT "UserCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

