-- AlterEnum
ALTER TYPE "ContributionStatus" ADD VALUE 'BLOCKED';

-- AlterTable
ALTER TABLE "TicketAssignee" ADD COLUMN     "note" TEXT;
