-- CreateEnum
CREATE TYPE "public"."Category" AS ENUM ('GROCERIES', 'HOUSEHOLD', 'DINING', 'UTILITIES', 'TRANSPORT', 'MISC');

-- CreateEnum
CREATE TYPE "public"."TriggerType" AS ENUM ('MERCHANT', 'KEYWORD');

-- CreateEnum
CREATE TYPE "public"."ActionSplit" AS ENUM ('EQUAL', 'BY_PERCENT', 'ASSIGN_TO');

-- CreateTable
CREATE TABLE "public"."User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Membership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Membership_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Receipt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "groupId" TEXT,
    "merchantRaw" TEXT,
    "merchantNormalized" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "subtotal" DECIMAL(10,2),
    "tax" DECIMAL(10,2),
    "tip" DECIMAL(10,2),
    "total" DECIMAL(10,2),
    "ocrJson" JSONB,
    "imageUrl" TEXT,
    "shareToken" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LineItem" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "descriptionRaw" TEXT,
    "descriptionNormalized" TEXT,
    "qty" INTEGER DEFAULT 1,
    "unitPrice" DECIMAL(10,2),
    "lineTotal" DECIMAL(10,2),
    "category" "public"."Category" DEFAULT 'MISC',
    "isShared" BOOLEAN NOT NULL DEFAULT true,
    "assignedToIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Rule" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "groupId" TEXT,
    "triggerType" "public"."TriggerType" NOT NULL,
    "triggerValue" TEXT NOT NULL,
    "actionCategory" "public"."Category",
    "actionSplit" "public"."ActionSplit",
    "actionAssignToIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "public"."User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Membership_userId_groupId_key" ON "public"."Membership"("userId", "groupId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_shareToken_key" ON "public"."Receipt"("shareToken");

-- CreateIndex
CREATE INDEX "Receipt_userId_idx" ON "public"."Receipt"("userId");

-- CreateIndex
CREATE INDEX "Receipt_groupId_idx" ON "public"."Receipt"("groupId");

-- CreateIndex
CREATE INDEX "Receipt_merchantNormalized_idx" ON "public"."Receipt"("merchantNormalized");

-- CreateIndex
CREATE INDEX "LineItem_receiptId_idx" ON "public"."LineItem"("receiptId");

-- CreateIndex
CREATE INDEX "Rule_userId_idx" ON "public"."Rule"("userId");

-- CreateIndex
CREATE INDEX "Rule_groupId_idx" ON "public"."Rule"("groupId");

-- CreateIndex
CREATE INDEX "Rule_triggerType_triggerValue_idx" ON "public"."Rule"("triggerType", "triggerValue");

-- AddForeignKey
ALTER TABLE "public"."Membership" ADD CONSTRAINT "Membership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Membership" ADD CONSTRAINT "Membership_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Receipt" ADD CONSTRAINT "Receipt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Receipt" ADD CONSTRAINT "Receipt_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LineItem" ADD CONSTRAINT "LineItem_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."Receipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Rule" ADD CONSTRAINT "Rule_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Rule" ADD CONSTRAINT "Rule_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "public"."Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
