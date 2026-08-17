ALTER TABLE "SaleItem" ADD COLUMN "listPrice" DOUBLE PRECISION;

UPDATE "SaleItem" SET "listPrice" = "unitPrice";

ALTER TABLE "SaleItem" ALTER COLUMN "listPrice" SET NOT NULL;
