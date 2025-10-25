-- AlterTable: add audioUrl and imageUrl, then drop attachments (destructive)

ALTER TABLE "exercises" ADD COLUMN "audioUrl" TEXT;
ALTER TABLE "exercises" ADD COLUMN "imageUrl" TEXT;

-- Drop the attachments column (this will remove any data stored there)
ALTER TABLE "exercises" DROP COLUMN IF EXISTS "attachments";
