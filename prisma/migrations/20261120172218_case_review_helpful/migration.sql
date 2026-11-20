-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "rejectionReason" TEXT;

-- CreateTable
CREATE TABLE "ObservationHelpful" (
    "observationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ObservationHelpful_pkey" PRIMARY KEY ("observationId","userId")
);

-- CreateIndex
CREATE INDEX "ObservationHelpful_userId_idx" ON "ObservationHelpful"("userId");

-- AddForeignKey
ALTER TABLE "ObservationHelpful" ADD CONSTRAINT "ObservationHelpful_observationId_fkey" FOREIGN KEY ("observationId") REFERENCES "Observation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ObservationHelpful" ADD CONSTRAINT "ObservationHelpful_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
