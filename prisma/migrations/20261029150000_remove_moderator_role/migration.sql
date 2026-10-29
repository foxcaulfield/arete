-- Safety net: downgrade any stray MODERATOR rows to USER before the type
-- swap. The USING clause below casts role::text::"user_role_new"; without
-- this UPDATE, the first MODERATOR row would abort the ALTER mid-migration.
-- Per handoff no such rows exist, but the UPDATE is free and a failed prod
-- migration is not.
UPDATE "users" SET "role" = 'USER' WHERE "role" = 'MODERATOR';

-- AlterEnum
BEGIN;
CREATE TYPE "user_role_new" AS ENUM ('USER', 'ADMIN');
ALTER TABLE "public"."users" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "role" TYPE "user_role_new" USING ("role"::text::"user_role_new");
ALTER TYPE "user_role" RENAME TO "user_role_old";
ALTER TYPE "user_role_new" RENAME TO "user_role";
DROP TYPE "public"."user_role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;