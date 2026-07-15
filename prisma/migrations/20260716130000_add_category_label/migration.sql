ALTER TABLE `categories`
    ADD COLUMN `label` ENUM('category', 'brand') NOT NULL DEFAULT 'category';
