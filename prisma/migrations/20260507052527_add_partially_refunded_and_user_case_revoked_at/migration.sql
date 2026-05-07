-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PARTIALLY_REFUNDED';

-- AlterTable
ALTER TABLE "UserCase" ADD COLUMN     "revokedAt" TIMESTAMP(3);
