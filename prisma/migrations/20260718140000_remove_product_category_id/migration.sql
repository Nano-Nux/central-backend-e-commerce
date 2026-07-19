INSERT IGNORE INTO `product_categories` (`product_id`, `category_id`)
SELECT `id`, `category_id`
FROM `products`
WHERE `category_id` IS NOT NULL;

ALTER TABLE `products`
  DROP FOREIGN KEY `products_category_id_fkey`;

ALTER TABLE `products`
  DROP INDEX `products_category_id_idx`;

ALTER TABLE `products`
  DROP COLUMN `category_id`;
