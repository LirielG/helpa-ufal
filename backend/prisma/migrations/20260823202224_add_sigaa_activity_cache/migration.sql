-- CreateTable
CREATE TABLE "sigaa_activities" (
    "id" TEXT NOT NULL,
    "sigaaId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "normalizedType" "ActivityType" NOT NULL DEFAULT 'EXTENSION',
    "department" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sigaa_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sigaa_activities_sigaaId_key" ON "sigaa_activities"("sigaaId");

-- CreateIndex
CREATE INDEX "sigaa_activities_isActive_idx" ON "sigaa_activities"("isActive");

-- CreateIndex
CREATE INDEX "sigaa_activities_type_idx" ON "sigaa_activities"("type");

-- CreateIndex
CREATE INDEX "sigaa_activities_normalizedType_idx" ON "sigaa_activities"("normalizedType");
