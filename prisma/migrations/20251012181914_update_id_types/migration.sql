-- AlterTable
ALTER TABLE "account" ALTER COLUMN "userId" SET DEFAULT gen_random_uuid();

-- AlterTable
ALTER TABLE "session" ALTER COLUMN "userId" SET DEFAULT gen_random_uuid();
