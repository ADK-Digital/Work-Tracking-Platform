-- CreateTable
CREATE TABLE "WorkItemStatus" (
    "id" TEXT NOT NULL,
    "workType" "WorkItemType" NOT NULL,
    "statusKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "WorkItemStatus_pkey" PRIMARY KEY ("id")
);

-- Seed statuses
INSERT INTO "WorkItemStatus" ("id", "workType", "statusKey", "label", "sortOrder", "isActive") VALUES
  (gen_random_uuid()::text, 'purchase_request', 'submitted', 'Submitted', 1, true),
  (gen_random_uuid()::text, 'purchase_request', 'quote_requested', 'Quote Requested', 2, true),
  (gen_random_uuid()::text, 'purchase_request', 'quote_received', 'Quote Received', 3, true),
  (gen_random_uuid()::text, 'purchase_request', 'ordered', 'Ordered', 4, true),
  (gen_random_uuid()::text, 'purchase_request', 'completed', 'Completed', 5, true),
  (gen_random_uuid()::text, 'task', 'submitted', 'Submitted', 1, true),
  (gen_random_uuid()::text, 'task', 'in_progress', 'In Progress', 2, true),
  (gen_random_uuid()::text, 'task', 'on_hold', 'On Hold', 3, true),
  (gen_random_uuid()::text, 'task', 'completed', 'Completed', 4, true);

-- AlterTable
ALTER TABLE "WorkItem" ADD COLUMN "statusId" TEXT;

-- Backfill status and statusId by type for non-deleted items
UPDATE "WorkItem" wi
SET "status" = 'submitted'
WHERE wi."deletedAt" IS NULL
  AND wi."type" = 'purchase_request'
  AND wi."status" NOT IN ('submitted','quote_requested','quote_received','ordered','completed');

UPDATE "WorkItem" wi
SET "status" = 'submitted'
WHERE wi."deletedAt" IS NULL
  AND wi."type" = 'task'
  AND wi."status" NOT IN ('submitted','in_progress','on_hold','completed');

UPDATE "WorkItem" wi
SET "statusId" = ws."id"
FROM "WorkItemStatus" ws
WHERE ws."workType" = wi."type"
  AND ws."statusKey" = wi."status";

UPDATE "WorkItem" wi
SET "statusId" = ws."id"
FROM "WorkItemStatus" ws
WHERE wi."statusId" IS NULL
  AND ws."workType" = wi."type"
  AND ws."statusKey" = 'submitted';

ALTER TABLE "WorkItem" ALTER COLUMN "statusId" SET NOT NULL;

-- constraints and indexes
CREATE UNIQUE INDEX "WorkItemStatus_workType_statusKey_key" ON "WorkItemStatus"("workType", "statusKey");
CREATE INDEX "WorkItemStatus_workType_sortOrder_idx" ON "WorkItemStatus"("workType", "sortOrder");
CREATE INDEX "WorkItemStatus_isActive_idx" ON "WorkItemStatus"("isActive");
CREATE INDEX "WorkItem_statusId_idx" ON "WorkItem"("statusId");

ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "WorkItemStatus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
