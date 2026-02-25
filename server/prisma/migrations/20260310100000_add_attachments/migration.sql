-- CreateEnum
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'attachment_added';
ALTER TYPE "ActivityEventType" ADD VALUE IF NOT EXISTS 'attachment_deleted';

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "workItemId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");

-- CreateIndex
CREATE INDEX "Attachment_workItemId_uploadedAt_idx" ON "Attachment"("workItemId", "uploadedAt");

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_workItemId_fkey" FOREIGN KEY ("workItemId") REFERENCES "WorkItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
