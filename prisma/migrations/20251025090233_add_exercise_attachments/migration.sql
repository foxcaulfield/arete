-- AlterTable
ALTER TABLE "exercises" ADD COLUMN     "attachments" TEXT[] DEFAULT ARRAY[]::TEXT[];
