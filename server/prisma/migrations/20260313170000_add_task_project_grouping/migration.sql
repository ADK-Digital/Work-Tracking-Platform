-- AlterTable
ALTER TABLE "WorkItem"
  ADD COLUMN IF NOT EXISTS "projectName" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkItem_projectName_idx" ON "WorkItem"("projectName");

-- CreateTable
CREATE TABLE IF NOT EXISTS "TaskProjectOption" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  CONSTRAINT "TaskProjectOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "TaskProjectOption_name_key" ON "TaskProjectOption"("name");
