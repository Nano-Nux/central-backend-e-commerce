CREATE TABLE `banner_image_list` (
    `id` CHAR(36) NOT NULL,
    `image_url` VARCHAR(2048) NOT NULL,
    `target_url` VARCHAR(2048) NULL,
    `display_order` INTEGER NOT NULL DEFAULT 0,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `banner_image_list_is_active_display_order_idx`(`is_active`, `display_order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
