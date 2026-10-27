-- CreateEnum
CREATE TYPE "DeadlineChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterTable
ALTER TABLE "DeadlineChange" ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "status" "DeadlineChangeStatus" NOT NULL DEFAULT 'APPROVED';

-- CreateIndex
CREATE INDEX "DeadlineChange_status_idx" ON "DeadlineChange"("status");
