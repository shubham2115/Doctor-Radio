-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "lastActivityAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE INDEX "Case_lastActivityAt_idx" ON "Case"("lastActivityAt");
