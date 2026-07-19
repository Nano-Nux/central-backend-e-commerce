CREATE TABLE `product_categories` (
  `product_id` CHAR(36) NOT NULL,
  `category_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`product_id`, `category_id`),
  INDEX `product_categories_category_id_idx` (`category_id`),
  CONSTRAINT `product_categories_product_id_fkey`
    FOREIGN KEY (`product_id`) REFERENCES `products` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `product_categories_category_id_fkey`
    FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
 ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `product_categories` (`product_id`, `category_id`)
SELECT `id`, `category_id`
FROM `products`
WHERE `category_id` IS NOT NULL;
