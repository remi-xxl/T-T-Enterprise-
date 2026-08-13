-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "hasVariants" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "SaleItem" ADD COLUMN     "variantId" INTEGER;

-- CreateTable
CREATE TABLE "Variant" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "colorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Variant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VariantInventory" (
    "id" SERIAL NOT NULL,
    "variantId" INTEGER NOT NULL,
    "totalCartons" INTEGER NOT NULL DEFAULT 0,
    "remainingCartons" INTEGER NOT NULL DEFAULT 0,
    "totalPieces" INTEGER NOT NULL DEFAULT 0,
    "remainingPieces" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VariantInventory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VariantInventory_variantId_key" ON "VariantInventory"("variantId");

-- AddForeignKey
ALTER TABLE "Variant" ADD CONSTRAINT "Variant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VariantInventory" ADD CONSTRAINT "VariantInventory_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "Variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
