-- CreateTable
CREATE TABLE "UserPinnedView" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPinnedView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserPinnedView_userId_kind_key_key" ON "UserPinnedView"("userId", "kind", "key");

-- CreateIndex
CREATE INDEX "UserPinnedView_userId_kind_idx" ON "UserPinnedView"("userId", "kind");

-- AddForeignKey
ALTER TABLE "UserPinnedView" ADD CONSTRAINT "UserPinnedView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
