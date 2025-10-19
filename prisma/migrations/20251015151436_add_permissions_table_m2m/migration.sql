/*
  Warnings:

  - You are about to drop the column `permissions` on the `users` table. All the data in the column will be lost.
  - You are about to drop the column `role` on the `users` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "UserPermission" AS ENUM ('create_collection', 'read_own_collections', 'update_own_collections', 'delete_own_collections', 'read_all_collections');

-- DropIndex
DROP INDEX "public"."user_role_idx";

-- AlterTable
ALTER TABLE "users" DROP COLUMN "permissions",
DROP COLUMN "role";

-- DropEnum
DROP TYPE "public"."user_role";

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" "UserPermission" NOT NULL,
    "description" TEXT,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_PermissionsToUser" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PermissionsToUser_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE INDEX "_PermissionsToUser_B_index" ON "_PermissionsToUser"("B");

-- AddForeignKey
ALTER TABLE "_PermissionsToUser" ADD CONSTRAINT "_PermissionsToUser_A_fkey" FOREIGN KEY ("A") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PermissionsToUser" ADD CONSTRAINT "_PermissionsToUser_B_fkey" FOREIGN KEY ("B") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
