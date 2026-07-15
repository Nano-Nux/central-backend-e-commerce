ALTER TABLE `product_variants`
  ADD UNIQUE INDEX `product_variants_id_product_id_key` (`id`, `product_id`);

ALTER TABLE `stock_items`
  DROP FOREIGN KEY `stock_items_variant_id_fkey`;

ALTER TABLE `stock_items`
  ADD INDEX `stock_items_variant_id_product_id_idx` (`variant_id`, `product_id`);

ALTER TABLE `stock_items`
  ADD CONSTRAINT `stock_items_variant_id_product_id_fkey`
  FOREIGN KEY (`variant_id`, `product_id`)
  REFERENCES `product_variants`(`id`, `product_id`)
  ON DELETE CASCADE ON UPDATE CASCADE;
