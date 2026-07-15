CREATE TABLE `vouchers` (
  `id` CHAR(36) NOT NULL,
  `code` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `discount_type` ENUM('FIXED', 'PERCENTAGE') NOT NULL,
  `discount_value` DECIMAL(15, 2) NOT NULL,
  `minimum_order_amount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
  `start_at` DATETIME(3) NULL,
  `end_at` DATETIME(3) NULL,
  `usage_limit` INT NULL,
  `used_count` INT NOT NULL DEFAULT 0,
  `is_active` BOOLEAN NOT NULL DEFAULT true,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `vouchers_code_key` (`code`),
  INDEX `vouchers_is_active_start_at_end_at_idx` (`is_active`, `start_at`, `end_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
