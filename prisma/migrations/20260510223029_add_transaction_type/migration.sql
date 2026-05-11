/*
  Warnings:

  - Added the required column `type` to the `Transaction` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('debit', 'credit');

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN     "type" "TransactionType" NOT NULL,
ALTER COLUMN "updatedAt" DROP DEFAULT;
