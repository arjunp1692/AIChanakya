-- AlterTable
ALTER TABLE "DailyReport" ADD COLUMN     "idempotencyKey" TEXT;

-- AlterTable
ALTER TABLE "DailyReportItem" ADD COLUMN     "created" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rowKey" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "TicketEvent" ADD COLUMN     "reportId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DailyReport_submittedById_idempotencyKey_key" ON "DailyReport"("submittedById", "idempotencyKey");

-- AddForeignKey
ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "DailyReport"("id") ON DELETE SET NULL ON UPDATE CASCADE;
