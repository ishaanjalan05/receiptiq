-- CreateTable
CREATE TABLE "public"."Split" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "createdBy" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "shareToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Split_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Split_shareToken_key" ON "public"."Split"("shareToken");

-- CreateIndex
CREATE INDEX "Split_receiptId_idx" ON "public"."Split"("receiptId");

-- AddForeignKey
ALTER TABLE "public"."Split" ADD CONSTRAINT "Split_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."Receipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
