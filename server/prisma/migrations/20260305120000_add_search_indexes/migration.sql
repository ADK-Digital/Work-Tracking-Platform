-- Search-supporting indexes for dashboard search/filtering
CREATE INDEX IF NOT EXISTS "WorkItem_updatedAt_idx" ON "WorkItem"("updatedAt");
CREATE INDEX IF NOT EXISTS "WorkItem_type_idx" ON "WorkItem"("type");
CREATE INDEX IF NOT EXISTS "WorkItem_status_idx" ON "WorkItem"("status");
CREATE INDEX IF NOT EXISTS "WorkItem_owner_idx" ON "WorkItem"("owner");

CREATE INDEX IF NOT EXISTS "ActivityEvent_workItemId_timestamp_idx" ON "ActivityEvent"("workItemId", "timestamp");
-- Comment(workItemId, createdAt) already exists from prior migration.
