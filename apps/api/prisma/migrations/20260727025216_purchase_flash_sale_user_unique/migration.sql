/*
  Warnings:

  - A unique constraint covering the columns `[flash_sale_id,user_id]` on the table `purchases` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "purchases_flash_sale_id_idx";

-- CreateIndex
CREATE UNIQUE INDEX "purchases_flash_sale_id_user_id_key" ON "purchases"("flash_sale_id", "user_id");
