-- DropIndex
DROP INDEX IF EXISTS "WorkItem_owner_idx";

-- AlterTable
ALTER TABLE "WorkItem"
  DROP COLUMN IF EXISTS "owner",
  ADD COLUMN "ownerGoogleId" TEXT NOT NULL DEFAULT 'unassigned',
  ADD COLUMN "ownerEmail" TEXT NOT NULL DEFAULT 'unassigned@example.org',
  ADD COLUMN "ownerName" TEXT NOT NULL DEFAULT 'Unassigned';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkItem_ownerGoogleId_idx" ON "WorkItem"("ownerGoogleId");
CREATE INDEX IF NOT EXISTS "WorkItem_ownerEmail_idx" ON "WorkItem"("ownerEmail");
