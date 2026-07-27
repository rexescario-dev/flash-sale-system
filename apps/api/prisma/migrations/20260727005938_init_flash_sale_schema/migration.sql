-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flash_sales" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "total_stock" INTEGER NOT NULL,
    "remaining_stock" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "flash_sales_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "flash_sales_total_stock_positive"
      CHECK ("total_stock" > 0),
    CONSTRAINT "flash_sales_remaining_stock_non_negative"
      CHECK ("remaining_stock" >= 0),
    CONSTRAINT "flash_sales_remaining_stock_lte_total"
      CHECK ("remaining_stock" <= "total_stock"),
    CONSTRAINT "flash_sales_starts_before_ends"
      CHECK ("starts_at" < "ends_at")
);

-- CreateTable
CREATE TABLE "purchases" (
    "id" TEXT NOT NULL,
    "flash_sale_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "purchased_at" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "purchases_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "flash_sales_product_id_idx" ON "flash_sales"("product_id");

-- CreateIndex
CREATE INDEX "purchases_flash_sale_id_idx" ON "purchases"("flash_sale_id");

-- AddForeignKey
ALTER TABLE "flash_sales" ADD CONSTRAINT "flash_sales_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchases" ADD CONSTRAINT "purchases_flash_sale_id_fkey" FOREIGN KEY ("flash_sale_id") REFERENCES "flash_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
