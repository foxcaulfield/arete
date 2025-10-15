-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('USER', 'ADMIN', 'MODERATOR');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "role" "user_role" NOT NULL DEFAULT 'USER';

-- CreateIndex
CREATE INDEX "user_role_idx" ON "users"("role");
