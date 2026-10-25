-- CreateEnum
CREATE TYPE "collection_access_level" AS ENUM ('VIEW', 'STUDY', 'EDIT');

-- AlterTable
ALTER TABLE "exercises" ALTER COLUMN "additional_correct_answers" SET NOT NULL,
ALTER COLUMN "distractors" SET NOT NULL;

-- CreateTable
CREATE TABLE "collection_shares" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "access_level" "collection_access_level" NOT NULL DEFAULT 'STUDY',
    "grantedById" TEXT,
    "granted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "collection_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "collection_shares_userId_idx" ON "collection_shares"("userId");

-- CreateIndex
CREATE INDEX "collection_shares_grantedById_idx" ON "collection_shares"("grantedById");

-- CreateIndex
CREATE UNIQUE INDEX "collection_shares_collectionId_userId_key" ON "collection_shares"("collectionId", "userId");

-- AddForeignKey
ALTER TABLE "collection_shares" ADD CONSTRAINT "collection_shares_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "collections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_shares" ADD CONSTRAINT "collection_shares_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "collection_shares" ADD CONSTRAINT "collection_shares_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

