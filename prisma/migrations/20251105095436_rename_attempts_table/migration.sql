/*
  Warnings:

  - You are about to drop the `attemps` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."attemps" DROP CONSTRAINT "attemps_exerciseId_fkey";

-- DropForeignKey
ALTER TABLE "public"."attemps" DROP CONSTRAINT "attemps_userId_fkey";

-- DropTable
DROP TABLE "public"."attemps";

-- CreateTable
CREATE TABLE "attempts" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attempts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attempts_userId_exerciseId_idx" ON "attempts"("userId", "exerciseId");

-- CreateIndex
CREATE INDEX "attempts_createdAt_idx" ON "attempts"("createdAt");

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
