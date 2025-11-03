/*
  Warnings:

  - You are about to drop the column `alternative_answers` on the `exercises` table. All the data in the column will be lost.
  - You are about to drop the column `tags` on the `exercises` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ExerciseType" AS ENUM ('FILL_IN_THE_BLANK', 'CHOICE_SINGLE');

-- AlterTable
ALTER TABLE "exercises" DROP COLUMN "alternative_answers",
DROP COLUMN "tags",
ADD COLUMN     "additional_correct_answers" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "distractors" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "type" "ExerciseType" NOT NULL DEFAULT 'FILL_IN_THE_BLANK';
