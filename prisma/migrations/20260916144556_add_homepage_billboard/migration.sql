-- AlterTable
ALTER TABLE "Store" ADD COLUMN     "homepageBillboardId" TEXT;

-- CreateIndex
CREATE INDEX "Store_homepageBillboardId_idx" ON "Store"("homepageBillboardId");

-- AddForeignKey
ALTER TABLE "Store" ADD CONSTRAINT "Store_homepageBillboardId_fkey" FOREIGN KEY ("homepageBillboardId") REFERENCES "Billboard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
