-- Canonicalize workflow status to WorkItem.statusId

-- Ensure every work item has a valid statusId based on existing status where possible
UPDATE "WorkItem" wi
SET "statusId" = ws."id"
FROM "WorkItemStatus" ws
WHERE wi."statusId" IS NULL
  AND ws."workType" = wi."type"
  AND ws."statusKey" = wi."status";

-- Safe fallback for any unsupported or missing legacy statuses
UPDATE "WorkItem" wi
SET "statusId" = ws."id"
FROM "WorkItemStatus" ws
WHERE wi."statusId" IS NULL
  AND wi."type" = 'purchase_request'
  AND ws."workType" = 'purchase_request'
  AND ws."statusKey" = 'submitted';

UPDATE "WorkItem" wi
SET "statusId" = ws."id"
FROM "WorkItemStatus" ws
WHERE wi."statusId" IS NULL
  AND wi."type" = 'task'
  AND ws."workType" = 'task'
  AND ws."statusKey" = 'submitted';

ALTER TABLE "WorkItem" ALTER COLUMN "statusId" SET NOT NULL;

-- Remove duplicated status storage to prevent drift
DROP INDEX IF EXISTS "WorkItem_status_idx";
ALTER TABLE "WorkItem" DROP COLUMN "status";
