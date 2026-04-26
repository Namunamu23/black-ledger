-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "emailLastError" TEXT,
ADD COLUMN     "emailSentAt" TIMESTAMP(3);
