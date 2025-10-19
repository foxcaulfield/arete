/*
  Warnings:

  - You are about to drop the column `description` on the `exercises` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `exercises` table. All the data in the column will be lost.
  - Added the required column `correct_answer` to the `exercises` table without a default value. This is not possible if the table is not empty.
  - Added the required column `question` to the `exercises` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "exercises" DROP COLUMN "description",
DROP COLUMN "title",
ADD COLUMN     "alternative_answers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "correct_answer" TEXT NOT NULL,
ADD COLUMN     "explanation" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "placeholder_sequence" TEXT DEFAULT '***',
ADD COLUMN     "question" TEXT NOT NULL,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "attemps" (
    "id" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attemps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attemps_userId_exerciseId_idx" ON "attemps"("userId", "exerciseId");

-- CreateIndex
CREATE INDEX "attemps_createdAt_idx" ON "attemps"("createdAt");

-- CreateIndex
CREATE INDEX "exercises_collectionId_idx" ON "exercises"("collectionId");

-- AddForeignKey
ALTER TABLE "attemps" ADD CONSTRAINT "attemps_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attemps" ADD CONSTRAINT "attemps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
