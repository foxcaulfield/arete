/*
  Warnings:

  - The `role` column on the `users` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('USER', 'ADMIN', 'MODERATOR');

-- DropIndex
DROP INDEX "public"."user_email_active_idx";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "role",
ADD COLUMN     "role" "user_role" NOT NULL DEFAULT 'USER';

-- CreateIndex
CREATE INDEX "user_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "user_created_at_idx" ON "users"("created_at");

-- CreateIndex
CREATE INDEX "user_is_active_idx" ON "users"("is_active");
