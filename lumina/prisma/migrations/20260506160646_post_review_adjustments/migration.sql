/*
  Warnings:

  - Dropped column `status` on `Extrato` and the `ExtratoStatus` enum (vestigial — synchronous flow does not use it).
  - Added `updatedAt` to `Transaction` (filled with CURRENT_TIMESTAMP for any existing rows).
  - Added CHECK constraints: `Transaction.confidence` ∈ [0, 1], `Goal.targetAmount` > 0.
*/

-- AlterTable
ALTER TABLE "Extrato" DROP COLUMN "status";

-- AlterTable
ALTER TABLE "Transaction" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- DropEnum
DROP TYPE "ExtratoStatus";

-- CheckConstraint
ALTER TABLE "Transaction"
  ADD CONSTRAINT "Transaction_confidence_check"
  CHECK ("confidence" >= 0 AND "confidence" <= 1);

-- CheckConstraint
ALTER TABLE "Goal"
  ADD CONSTRAINT "Goal_targetAmount_positive_check"
  CHECK ("targetAmount" > 0);
