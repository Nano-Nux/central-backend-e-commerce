-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `failed_attempts` INTEGER NOT NULL DEFAULT 0,
    `locked_until` DATETIME(3) NULL,
    `status` ENUM('active', 'inactive') NOT NULL DEFAULT 'active',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    INDEX `users_locked_until_idx`(`locked_until`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `roles` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,

    UNIQUE INDEX `roles_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_roles` (
    `user_id` CHAR(36) NOT NULL,
    `role_id` CHAR(36) NOT NULL,

    INDEX `user_roles_role_id_idx`(`role_id`),
    PRIMARY KEY (`user_id`, `role_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `refresh_tokens` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `token` CHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `refresh_tokens_token_key`(`token`),
    INDEX `refresh_tokens_user_id_idx`(`user_id`),
    INDEX `refresh_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` CHAR(36) NOT NULL,
    `actor_id` CHAR(36) NULL,
    `action` VARCHAR(100) NOT NULL,
    `entity_type` VARCHAR(100) NOT NULL,
    `entity_id` VARCHAR(255) NOT NULL,
    `before` JSON NULL,
    `after` JSON NULL,
    `metadata` JSON NULL,
    `ip_address` VARCHAR(45) NULL,
    `user_agent` VARCHAR(512) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `audit_logs_actor_id_created_at_idx`(`actor_id`, `created_at`),
    INDEX `audit_logs_action_created_at_idx`(`action`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `categories` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `parent_id` CHAR(36) NULL,
    `description` TEXT NULL,
    `image_url` VARCHAR(2048) NULL,
    `path` VARCHAR(768) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `categories_slug_key`(`slug`),
    INDEX `categories_parent_id_idx`(`parent_id`),
    INDEX `categories_path_idx`(`path`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `slug` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `short_description` VARCHAR(500) NULL,
    `sku` VARCHAR(100) NOT NULL,
    `barcode` VARCHAR(100) NULL,
    `type` ENUM('PHYSICAL', 'DIGITAL', 'SERVICE', 'FOOD') NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `is_featured` BOOLEAN NOT NULL DEFAULT false,
    `is_stock_tracked` BOOLEAN NOT NULL DEFAULT true,
    `is_serialized` BOOLEAN NOT NULL DEFAULT false,
    `category_id` CHAR(36) NULL,
    `published_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `products_slug_key`(`slug`),
    UNIQUE INDEX `products_sku_key`(`sku`),
    INDEX `products_barcode_idx`(`barcode`),
    INDEX `products_category_id_idx`(`category_id`),
    INDEX `products_is_featured_created_at_idx`(`is_featured`, `created_at`),
    INDEX `products_published_at_idx`(`published_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_variants` (
    `id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `sku` VARCHAR(100) NOT NULL,
    `barcode` VARCHAR(100) NULL,
    `attributes` JSON NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `deleted_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `product_variants_product_id_idx`(`product_id`),
    INDEX `product_variants_sku_idx`(`sku`),
    INDEX `product_variants_barcode_idx`(`barcode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_images` (
    `id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `url` VARCHAR(2048) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,

    INDEX `product_images_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_attributes` (
    `id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `key` VARCHAR(100) NOT NULL,
    `value` TEXT NOT NULL,

    INDEX `product_attributes_product_id_idx`(`product_id`),
    INDEX `product_attributes_key_idx`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_prices` (
    `id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `variant_id` CHAR(36) NULL,
    `cost_price` DECIMAL(15, 2) NOT NULL,
    `selling_price` DECIMAL(15, 2) NOT NULL,
    `wholesale_price` DECIMAL(15, 2) NULL,
    `member_price` DECIMAL(15, 2) NULL,
    `promotion_price` DECIMAL(15, 2) NULL,
    `promotion_start_at` DATETIME(3) NULL,
    `promotion_end_at` DATETIME(3) NULL,

    INDEX `product_prices_product_id_idx`(`product_id`),
    INDEX `product_prices_variant_id_idx`(`variant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attribute_definitions` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `value_type` ENUM('TEXT', 'NUMBER', 'BOOLEAN', 'SELECT', 'DATE', 'JSON') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `attribute_definitions_code_key`(`code`),
    INDEX `attribute_definitions_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `attribute_definition_options` (
    `id` CHAR(36) NOT NULL,
    `definition_id` CHAR(36) NOT NULL,
    `value` VARCHAR(255) NOT NULL,
    `label` VARCHAR(255) NOT NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `attribute_definition_options_definition_id_position_idx`(`definition_id`, `position`),
    UNIQUE INDEX `attribute_definition_options_definition_id_value_key`(`definition_id`, `value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_attribute_assignments` (
    `id` CHAR(36) NOT NULL,
    `definition_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `variant_id` CHAR(36) NULL,
    `value_text` TEXT NULL,
    `value_number` DECIMAL(18, 6) NULL,
    `value_boolean` BOOLEAN NULL,
    `value_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `product_attribute_assignments_definition_id_idx`(`definition_id`),
    INDEX `product_attribute_assignments_product_id_idx`(`product_id`),
    INDEX `product_attribute_assignments_variant_id_idx`(`variant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `measurement_groups` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `measurement_groups_code_key`(`code`),
    INDEX `measurement_groups_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `unit_definitions` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `symbol` VARCHAR(50) NULL,
    `measurement_group_id` CHAR(36) NULL,
    `allows_decimal` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `unit_definitions_code_key`(`code`),
    INDEX `unit_definitions_measurement_group_id_idx`(`measurement_group_id`),
    INDEX `unit_definitions_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_items` (
    `id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `variant_id` CHAR(36) NULL,
    `name` VARCHAR(255) NOT NULL,
    `sku` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `track_inventory` BOOLEAN NOT NULL DEFAULT true,
    `tracking_mode` ENUM('SIMPLE', 'BATCH', 'ASSET') NOT NULL DEFAULT 'SIMPLE',
    `base_unit_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `stock_items_product_id_idx`(`product_id`),
    INDEX `stock_items_variant_id_idx`(`variant_id`),
    INDEX `stock_items_base_unit_id_idx`(`base_unit_id`),
    UNIQUE INDEX `stock_items_product_id_variant_id_key`(`product_id`, `variant_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_item_configurations` (
    `stock_item_id` CHAR(36) NOT NULL,
    `track_batches` BOOLEAN NOT NULL DEFAULT false,
    `track_expiry` BOOLEAN NOT NULL DEFAULT false,
    `track_unique_assets` BOOLEAN NOT NULL DEFAULT false,
    `track_reservations` BOOLEAN NOT NULL DEFAULT true,
    `allow_unit_conversions` BOOLEAN NOT NULL DEFAULT false,
    `allow_pack_breaking` BOOLEAN NOT NULL DEFAULT false,
    `allow_multiple_barcodes` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`stock_item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_item_identifier_rules` (
    `id` CHAR(36) NOT NULL,
    `stock_item_id` CHAR(36) NOT NULL,
    `identifier_type_id` CHAR(36) NOT NULL,
    `is_required` BOOLEAN NOT NULL DEFAULT true,
    `min_count` INTEGER NOT NULL DEFAULT 1,
    `max_count` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `stock_item_identifier_rules_identifier_type_id_idx`(`identifier_type_id`),
    UNIQUE INDEX `stock_item_identifier_rules_stock_item_id_identifier_type_id_key`(`stock_item_id`, `identifier_type_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_item_units` (
    `id` CHAR(36) NOT NULL,
    `stock_item_id` CHAR(36) NOT NULL,
    `unit_id` CHAR(36) NOT NULL,
    `conversion_to_base` DECIMAL(20, 8) NOT NULL,
    `is_base_unit` BOOLEAN NOT NULL DEFAULT false,
    `is_sales_unit` BOOLEAN NOT NULL DEFAULT false,
    `is_purchase_unit` BOOLEAN NOT NULL DEFAULT false,
    `allows_fractional` BOOLEAN NOT NULL DEFAULT true,
    `position` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `stock_item_units_unit_id_idx`(`unit_id`),
    INDEX `stock_item_units_stock_item_id_position_idx`(`stock_item_id`, `position`),
    UNIQUE INDEX `stock_item_units_stock_item_id_unit_id_key`(`stock_item_id`, `unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_item_unit_conversions` (
    `id` CHAR(36) NOT NULL,
    `stock_item_id` CHAR(36) NOT NULL,
    `from_unit_id` CHAR(36) NOT NULL,
    `to_unit_id` CHAR(36) NOT NULL,
    `factor` DECIMAL(20, 8) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `stock_item_unit_conversions_from_unit_id_idx`(`from_unit_id`),
    INDEX `stock_item_unit_conversions_to_unit_id_idx`(`to_unit_id`),
    UNIQUE INDEX `stock_item_unit_conversions_stock_item_id_from_unit_id_to_un_key`(`stock_item_id`, `from_unit_id`, `to_unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_items` (
    `id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `stock_item_id` CHAR(36) NULL,
    `quantity_on_hand` DECIMAL(15, 3) NOT NULL DEFAULT 0,
    `reserved_quantity` DECIMAL(15, 3) NOT NULL DEFAULT 0,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inventory_items_stock_item_id_key`(`stock_item_id`),
    INDEX `inventory_items_product_id_idx`(`product_id`),
    INDEX `inventory_items_stock_item_id_idx`(`stock_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_batches` (
    `id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `stock_item_id` CHAR(36) NULL,
    `batch_code` VARCHAR(100) NOT NULL,
    `quantity_received` DECIMAL(15, 3) NOT NULL,
    `quantity_remaining` DECIMAL(15, 3) NOT NULL,
    `unit_cost` DECIMAL(15, 2) NOT NULL,
    `manufacture_date` DATETIME(3) NULL,
    `expiry_date` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `inventory_batches_product_id_expiry_date_idx`(`product_id`, `expiry_date`),
    INDEX `inventory_batches_stock_item_id_expiry_date_idx`(`stock_item_id`, `expiry_date`),
    INDEX `inventory_batches_product_id_quantity_remaining_idx`(`product_id`, `quantity_remaining`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_movements` (
    `id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `stock_item_id` CHAR(36) NULL,
    `unit_id` CHAR(36) NULL,
    `type` ENUM('IN', 'OUT', 'ADJUSTMENT', 'RETURN') NOT NULL,
    `event_key` VARCHAR(255) NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `base_quantity` DECIMAL(20, 8) NULL,
    `unit_cost` DECIMAL(15, 2) NULL,
    `reference_type` ENUM('ORDER', 'PURCHASE', 'ADJUSTMENT', 'RETURN') NOT NULL,
    `reference_id` VARCHAR(255) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `inventory_movements_event_key_key`(`event_key`),
    INDEX `inventory_movements_product_id_created_at_idx`(`product_id`, `created_at`),
    INDEX `inventory_movements_stock_item_id_created_at_idx`(`stock_item_id`, `created_at`),
    INDEX `inventory_movements_reference_type_reference_id_idx`(`reference_type`, `reference_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_reservations` (
    `id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `stock_item_id` CHAR(36) NULL,
    `unit_id` CHAR(36) NULL,
    `asset_ids` JSON NULL,
    `reference_id` VARCHAR(255) NOT NULL,
    `reservation_key` VARCHAR(255) NOT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `base_quantity` DECIMAL(20, 8) NULL,
    `status` ENUM('ACTIVE', 'RELEASED') NOT NULL DEFAULT 'ACTIVE',
    `released_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inventory_reservations_reservation_key_key`(`reservation_key`),
    INDEX `inventory_reservations_product_id_reference_id_idx`(`product_id`, `reference_id`),
    INDEX `inventory_reservations_stock_item_id_reference_id_idx`(`stock_item_id`, `reference_id`),
    INDEX `inventory_reservations_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_serials` (
    `id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `stock_item_id` CHAR(36) NULL,
    `asset_id` CHAR(36) NULL,
    `serial_number` VARCHAR(255) NOT NULL,
    `status` ENUM('AVAILABLE', 'SOLD', 'RETURNED') NOT NULL DEFAULT 'AVAILABLE',
    `reference_id` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `inventory_serials_asset_id_key`(`asset_id`),
    UNIQUE INDEX `inventory_serials_serial_number_key`(`serial_number`),
    INDEX `inventory_serials_product_id_idx`(`product_id`),
    INDEX `inventory_serials_stock_item_id_idx`(`stock_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_identifier_types` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `description` TEXT NULL,
    `validation_regex` VARCHAR(1000) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inventory_identifier_types_code_key`(`code`),
    INDEX `inventory_identifier_types_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_assets` (
    `id` CHAR(36) NOT NULL,
    `stock_item_id` CHAR(36) NOT NULL,
    `batch_id` CHAR(36) NULL,
    `asset_tag` VARCHAR(255) NULL,
    `status` ENUM('AVAILABLE', 'RESERVED', 'SOLD', 'RETURNED', 'INACTIVE') NOT NULL DEFAULT 'AVAILABLE',
    `metadata_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `inventory_assets_stock_item_id_idx`(`stock_item_id`),
    INDEX `inventory_assets_batch_id_idx`(`batch_id`),
    INDEX `inventory_assets_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_asset_identifiers` (
    `id` CHAR(36) NOT NULL,
    `asset_id` CHAR(36) NOT NULL,
    `identifier_type_id` CHAR(36) NOT NULL,
    `value` VARCHAR(255) NOT NULL,
    `normalized_value` VARCHAR(255) NOT NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `inventory_asset_identifiers_asset_id_idx`(`asset_id`),
    UNIQUE INDEX `inventory_asset_identifiers_identifier_type_id_normalized_va_key`(`identifier_type_id`, `normalized_value`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `barcode_registry` (
    `id` CHAR(36) NOT NULL,
    `code` VARCHAR(255) NOT NULL,
    `normalized_code` VARCHAR(255) NOT NULL,
    `symbology` VARCHAR(50) NOT NULL,
    `owner_type` ENUM('PRODUCT', 'PRODUCT_VARIANT', 'STOCK_ITEM', 'STOCK_ITEM_UNIT', 'INVENTORY_ASSET', 'INVENTORY_BATCH') NOT NULL,
    `owner_id` VARCHAR(255) NOT NULL,
    `product_id` CHAR(36) NULL,
    `variant_id` CHAR(36) NULL,
    `stock_item_id` CHAR(36) NULL,
    `stock_item_unit_id` CHAR(36) NULL,
    `inventory_asset_id` CHAR(36) NULL,
    `inventory_batch_id` CHAR(36) NULL,
    `is_primary` BOOLEAN NOT NULL DEFAULT false,
    `is_generated` BOOLEAN NOT NULL DEFAULT false,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `metadata_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `barcode_registry_normalized_code_key`(`normalized_code`),
    INDEX `barcode_registry_owner_type_owner_id_idx`(`owner_type`, `owner_id`),
    INDEX `barcode_registry_product_id_idx`(`product_id`),
    INDEX `barcode_registry_variant_id_idx`(`variant_id`),
    INDEX `barcode_registry_stock_item_id_idx`(`stock_item_id`),
    INDEX `barcode_registry_stock_item_unit_id_idx`(`stock_item_unit_id`),
    INDEX `barcode_registry_inventory_asset_id_idx`(`inventory_asset_id`),
    INDEX `barcode_registry_inventory_batch_id_idx`(`inventory_batch_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_transformations` (
    `id` CHAR(36) NOT NULL,
    `type` ENUM('PACK_BREAK', 'REPACK', 'ASSEMBLY', 'ADJUSTMENT') NOT NULL,
    `reference_id` VARCHAR(255) NULL,
    `notes` TEXT NULL,
    `created_by` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `inventory_transformations_type_created_at_idx`(`type`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_transformation_lines` (
    `id` CHAR(36) NOT NULL,
    `transformation_id` CHAR(36) NOT NULL,
    `stock_item_id` CHAR(36) NOT NULL,
    `unit_id` CHAR(36) NULL,
    `direction` ENUM('IN', 'OUT') NOT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `base_quantity` DECIMAL(20, 8) NULL,
    `unit_cost` DECIMAL(15, 2) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `inventory_transformation_lines_transformation_id_idx`(`transformation_id`),
    INDEX `inventory_transformation_lines_stock_item_id_idx`(`stock_item_id`),
    INDEX `inventory_transformation_lines_unit_id_idx`(`unit_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` CHAR(36) NOT NULL,
    `request_key` VARCHAR(255) NULL,
    `customer_id` CHAR(36) NULL,
    `type` ENUM('CUSTOMER', 'GUEST', 'POS') NOT NULL DEFAULT 'CUSTOMER',
    `guest_name` VARCHAR(255) NULL,
    `guest_email` VARCHAR(255) NULL,
    `guest_phone` VARCHAR(50) NULL,
    `contact_name` VARCHAR(255) NULL,
    `contact_email` VARCHAR(255) NULL,
    `contact_phone` VARCHAR(50) NULL,
    `shipping_address_json` JSON NULL,
    `billing_address_json` JSON NULL,
    `order_notes` TEXT NULL,
    `status` ENUM('PENDING', 'PAID', 'CANCELLED', 'REFUNDED', 'COMPLETED') NOT NULL DEFAULT 'PENDING',
    `source` ENUM('POS', 'ONLINE') NOT NULL,
    `subtotal` DECIMAL(15, 2) NOT NULL,
    `discount` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `tax` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(15, 2) NOT NULL,
    `currency` VARCHAR(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `orders_request_key_key`(`request_key`),
    INDEX `orders_customer_id_created_at_idx`(`customer_id`, `created_at`),
    INDEX `orders_guest_email_created_at_idx`(`guest_email`, `created_at`),
    INDEX `orders_status_idx`(`status`),
    INDEX `orders_source_idx`(`source`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customers` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(50) NULL,
    `email` VARCHAR(255) NULL,
    `type` ENUM('RETAIL', 'WHOLESALE') NOT NULL DEFAULT 'RETAIL',
    `user_id` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `customers_phone_idx`(`phone`),
    INDEX `customers_email_idx`(`email`),
    INDEX `customers_type_idx`(`type`),
    INDEX `customers_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_addresses` (
    `id` CHAR(36) NOT NULL,
    `customer_id` CHAR(36) NOT NULL,
    `address_line` VARCHAR(500) NOT NULL,
    `label` VARCHAR(100) NULL,
    `recipient_name` VARCHAR(255) NULL,
    `phone` VARCHAR(50) NULL,
    `address_line_2` VARCHAR(500) NULL,
    `city` VARCHAR(100) NOT NULL,
    `state_or_province` VARCHAR(100) NULL,
    `postal_code` VARCHAR(20) NOT NULL,
    `country` VARCHAR(100) NOT NULL,
    `is_default` BOOLEAN NOT NULL DEFAULT false,
    `is_default_shipping` BOOLEAN NOT NULL DEFAULT false,
    `is_default_billing` BOOLEAN NOT NULL DEFAULT false,

    INDEX `customer_addresses_customer_id_idx`(`customer_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_tags` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `color` VARCHAR(30) NULL,

    UNIQUE INDEX `customer_tags_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_tag_map` (
    `customer_id` CHAR(36) NOT NULL,
    `tag_id` CHAR(36) NOT NULL,

    INDEX `customer_tag_map_tag_id_idx`(`tag_id`),
    PRIMARY KEY (`customer_id`, `tag_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_notes` (
    `id` CHAR(36) NOT NULL,
    `customer_id` CHAR(36) NOT NULL,
    `content` TEXT NOT NULL,
    `created_by` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `customer_notes_customer_id_idx`(`customer_id`),
    INDEX `customer_notes_created_by_idx`(`created_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `customer_activities` (
    `id` CHAR(36) NOT NULL,
    `customer_id` CHAR(36) NOT NULL,
    `event_key` VARCHAR(255) NULL,
    `type` VARCHAR(100) NOT NULL,
    `description` VARCHAR(500) NOT NULL,
    `metadata` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `customer_activities_event_key_key`(`event_key`),
    INDEX `customer_activities_customer_id_created_at_idx`(`customer_id`, `created_at`),
    INDEX `customer_activities_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversations` (
    `id` CHAR(36) NOT NULL,
    `customer_id` CHAR(36) NULL,
    `channel_type` ENUM('EMAIL', 'WEBSITE_CHAT', 'LINE', 'TELEGRAM', 'DISCORD', 'FACEBOOK_MESSENGER', 'INSTAGRAM', 'TIKTOK') NOT NULL,
    `external_conversation_id` VARCHAR(255) NULL,
    `status` ENUM('OPEN', 'CLOSED', 'ARCHIVED') NOT NULL DEFAULT 'OPEN',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `conversations_customer_id_idx`(`customer_id`),
    INDEX `conversations_channel_type_idx`(`channel_type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversation_participants` (
    `id` CHAR(36) NOT NULL,
    `conversation_id` CHAR(36) NOT NULL,
    `participant_type` ENUM('CUSTOMER', 'USER', 'BOT') NOT NULL,
    `participant_id` VARCHAR(255) NOT NULL,

    INDEX `conversation_participants_conversation_id_idx`(`conversation_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messages` (
    `id` CHAR(36) NOT NULL,
    `conversation_id` CHAR(36) NOT NULL,
    `direction` ENUM('INBOUND', 'OUTBOUND') NOT NULL,
    `content` TEXT NOT NULL,
    `metadata` JSON NULL,
    `sent_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `messages_conversation_id_idx`(`conversation_id`),
    INDEX `messages_sent_at_idx`(`sent_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `communication_channels` (
    `id` CHAR(36) NOT NULL,
    `type` ENUM('EMAIL', 'WEBSITE_CHAT', 'LINE', 'TELEGRAM', 'DISCORD', 'FACEBOOK_MESSENGER', 'INSTAGRAM', 'TIKTOK') NOT NULL,
    `config_json` JSON NOT NULL,
    `is_enabled` BOOLEAN NOT NULL DEFAULT true,

    INDEX `communication_channels_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_templates` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `subject` VARCHAR(500) NOT NULL,
    `body` TEXT NOT NULL,

    UNIQUE INDEX `email_templates_name_key`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `email_queue` (
    `id` CHAR(36) NOT NULL,
    `to_email` VARCHAR(255) NOT NULL,
    `subject` VARCHAR(500) NOT NULL,
    `body` TEXT NOT NULL,
    `status` VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    `scheduled_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `sent_at` DATETIME(3) NULL,

    INDEX `email_queue_status_idx`(`status`),
    INDEX `email_queue_scheduled_at_idx`(`scheduled_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflows` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `trigger_event` VARCHAR(100) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `workflows_trigger_event_idx`(`trigger_event`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_rules` (
    `id` CHAR(36) NOT NULL,
    `workflow_id` CHAR(36) NOT NULL,
    `condition_json` JSON NOT NULL,
    `action_json` JSON NOT NULL,
    `order_index` INTEGER NOT NULL DEFAULT 0,

    INDEX `workflow_rules_workflow_id_idx`(`workflow_id`),
    INDEX `workflow_rules_workflow_id_order_index_idx`(`workflow_id`, `order_index`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_executions` (
    `id` CHAR(36) NOT NULL,
    `workflow_id` CHAR(36) NOT NULL,
    `event_key` VARCHAR(255) NULL,
    `status` ENUM('SUCCESS', 'FAILED', 'RUNNING') NOT NULL DEFAULT 'RUNNING',
    `input_json` JSON NOT NULL,
    `output_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `workflow_executions_event_key_key`(`event_key`),
    INDEX `workflow_executions_workflow_id_idx`(`workflow_id`),
    INDEX `workflow_executions_status_idx`(`status`),
    INDEX `workflow_executions_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `outbox_events` (
    `id` CHAR(36) NOT NULL,
    `event_id` CHAR(36) NOT NULL,
    `event_name` VARCHAR(255) NOT NULL,
    `payload_json` JSON NOT NULL,
    `metadata_json` JSON NULL,
    `status` ENUM('PENDING', 'PROCESSING', 'PROCESSED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `available_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `locked_at` DATETIME(3) NULL,
    `processed_at` DATETIME(3) NULL,
    `last_error` VARCHAR(1000) NULL,
    `occurred_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `outbox_events_event_id_key`(`event_id`),
    INDEX `outbox_events_status_available_at_idx`(`status`, `available_at`),
    INDEX `outbox_events_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `inventory_reconciliation_exceptions` (
    `id` CHAR(36) NOT NULL,
    `exception_key` VARCHAR(255) NOT NULL,
    `type` ENUM('MISSING_ORDER_STOCK_OUT', 'MISSING_REFUND_RESTOCK', 'PURCHASE_STOCK_IN_REPAIR_FAILED', 'STALE_RESERVATION_RELEASE_FAILED') NOT NULL,
    `status` ENUM('OPEN', 'RESOLVED') NOT NULL DEFAULT 'OPEN',
    `entity_type` VARCHAR(100) NOT NULL,
    `entity_id` VARCHAR(255) NOT NULL,
    `product_id` CHAR(36) NULL,
    `payload_json` JSON NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `last_attempt_at` DATETIME(3) NULL,
    `last_error` VARCHAR(1000) NULL,
    `resolved_at` DATETIME(3) NULL,
    `resolved_by` CHAR(36) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `inventory_reconciliation_exceptions_exception_key_key`(`exception_key`),
    INDEX `inventory_reconciliation_exceptions_status_type_idx`(`status`, `type`),
    INDEX `inventory_reconciliation_exceptions_entity_type_entity_id_idx`(`entity_type`, `entity_id`),
    INDEX `inventory_reconciliation_exceptions_product_id_idx`(`product_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `workflow_logs` (
    `id` CHAR(36) NOT NULL,
    `execution_id` CHAR(36) NOT NULL,
    `message` VARCHAR(1000) NOT NULL,
    `level` VARCHAR(20) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `workflow_logs_execution_id_idx`(`execution_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_providers` (
    `id` CHAR(36) NOT NULL,
    `name` ENUM('OPENAI', 'GEMINI', 'LOCAL', 'OTHER') NOT NULL,
    `config_json` JSON NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_providers_name_idx`(`name`),
    INDEX `ai_providers_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_requests` (
    `id` CHAR(36) NOT NULL,
    `provider_id` CHAR(36) NOT NULL,
    `module_source` ENUM('ORDER', 'WORKFLOW', 'CRM', 'SYSTEM') NOT NULL,
    `input_json` JSON NOT NULL,
    `output_json` JSON NULL,
    `tokens_used` INTEGER NULL,
    `status` ENUM('SUCCESS', 'FAILED') NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_requests_provider_id_idx`(`provider_id`),
    INDEX `ai_requests_module_source_idx`(`module_source`),
    INDEX `ai_requests_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_sessions` (
    `id` CHAR(36) NOT NULL,
    `context_json` JSON NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_items` (
    `id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `stock_item_id` CHAR(36) NULL,
    `variant_id` CHAR(36) NULL,
    `unit_id` CHAR(36) NULL,
    `asset_ids` JSON NULL,
    `serial_numbers` JSON NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `base_quantity` DECIMAL(20, 8) NULL,
    `unit_price` DECIMAL(15, 2) NOT NULL,
    `total_price` DECIMAL(15, 2) NOT NULL,

    INDEX `order_items_order_id_idx`(`order_id`),
    INDEX `order_items_product_id_idx`(`product_id`),
    INDEX `order_items_stock_item_id_idx`(`stock_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `method` ENUM('CASH', 'CARD', 'TRANSFER', 'ONLINE', 'QR_MANUAL') NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `status` ENUM('PENDING', 'AWAITING_VERIFICATION', 'SUCCESS', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `reference` VARCHAR(255) NULL,
    `idempotency_key` VARCHAR(255) NULL,
    `refund_of_payment_id` CHAR(36) NULL,
    `merchant_payment_configuration_id` CHAR(36) NULL,
    `verification_context_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_reference_key`(`reference`),
    UNIQUE INDEX `payments_idempotency_key_key`(`idempotency_key`),
    UNIQUE INDEX `payments_refund_of_payment_id_key`(`refund_of_payment_id`),
    INDEX `payments_order_id_idx`(`order_id`),
    INDEX `payments_merchant_payment_configuration_id_idx`(`merchant_payment_configuration_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `merchant_payment_configurations` (
    `id` CHAR(36) NOT NULL,
    `provider_name` ENUM('TH_PROMPTPAY', 'MM_KBZPAY', 'MM_WAVEPAY') NOT NULL,
    `country_code` VARCHAR(10) NOT NULL,
    `account_name` VARCHAR(255) NOT NULL,
    `account_number` VARCHAR(255) NOT NULL,
    `qr_image_file_id` CHAR(36) NOT NULL,
    `qr_image_bucket` VARCHAR(255) NOT NULL,
    `qr_image_object_name` VARCHAR(512) NOT NULL,
    `qr_image_content_type` VARCHAR(255) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `merchant_payment_configurations_qr_image_file_id_key`(`qr_image_file_id`),
    INDEX `merchant_payment_configurations_provider_name_is_active_idx`(`provider_name`, `is_active`),
    INDEX `merchant_payment_configurations_is_active_idx`(`is_active`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `guest_order_verifications` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `code_hash` CHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `consumed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `guest_order_verifications_token_hash_key`(`token_hash`),
    INDEX `guest_order_verifications_email_created_at_idx`(`email`, `created_at`),
    INDEX `guest_order_verifications_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `guest_order_access_tokens` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(255) NOT NULL,
    `token_hash` CHAR(64) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `consumed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `guest_order_access_tokens_token_hash_key`(`token_hash`),
    INDEX `guest_order_access_tokens_email_created_at_idx`(`email`, `created_at`),
    INDEX `guest_order_access_tokens_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `carts` (
    `id` CHAR(36) NOT NULL,
    `customer_id` CHAR(36) NOT NULL,
    `currency` VARCHAR(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `carts_customer_id_key`(`customer_id`),
    INDEX `carts_updated_at_idx`(`updated_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `cart_items` (
    `id` CHAR(36) NOT NULL,
    `cart_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `stock_item_id` CHAR(36) NULL,
    `variant_id` CHAR(36) NULL,
    `unit_id` CHAR(36) NULL,
    `line_key` VARCHAR(255) NOT NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `base_quantity` DECIMAL(20, 8) NULL,
    `metadata_json` JSON NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `cart_items_cart_id_updated_at_idx`(`cart_id`, `updated_at`),
    INDEX `cart_items_product_id_idx`(`product_id`),
    INDEX `cart_items_stock_item_id_idx`(`stock_item_id`),
    UNIQUE INDEX `cart_items_cart_id_line_key_key`(`cart_id`, `line_key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_proofs` (
    `id` CHAR(36) NOT NULL,
    `payment_id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `bucket` VARCHAR(255) NOT NULL,
    `object_name` VARCHAR(512) NOT NULL,
    `original_filename` VARCHAR(255) NOT NULL,
    `content_type` VARCHAR(255) NOT NULL,
    `size` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `rejection_reason` VARCHAR(500) NULL,
    `uploaded_by_user_id` CHAR(36) NULL,
    `reviewed_by_user_id` CHAR(36) NULL,
    `reviewed_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `payment_proofs_payment_id_created_at_idx`(`payment_id`, `created_at`),
    INDEX `payment_proofs_order_id_created_at_idx`(`order_id`, `created_at`),
    INDEX `payment_proofs_status_created_at_idx`(`status`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_provider_sessions` (
    `id` CHAR(36) NOT NULL,
    `payment_id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `provider` ENUM('MANUAL_TRANSFER', 'QR_TRANSFER', 'LINE_PAY') NOT NULL,
    `provider_session_id` VARCHAR(255) NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'FAILED', 'EXPIRED') NOT NULL DEFAULT 'PENDING',
    `payment_url` VARCHAR(2048) NULL,
    `return_url` VARCHAR(2048) NULL,
    `cancel_url` VARCHAR(2048) NULL,
    `callback_data_json` JSON NULL,
    `confirmed_at` DATETIME(3) NULL,
    `expires_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payment_provider_sessions_provider_session_id_key`(`provider_session_id`),
    INDEX `payment_provider_sessions_payment_id_created_at_idx`(`payment_id`, `created_at`),
    INDEX `payment_provider_sessions_order_id_created_at_idx`(`order_id`, `created_at`),
    INDEX `payment_provider_sessions_provider_status_idx`(`provider`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pos_sessions` (
    `id` CHAR(36) NOT NULL,
    `user_id` CHAR(36) NOT NULL,
    `opened_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `closed_at` DATETIME(3) NULL,
    `cash_in_hand` DECIMAL(15, 2) NOT NULL,
    `expected_cash` DECIMAL(15, 2) NULL,
    `counted_cash` DECIMAL(15, 2) NULL,
    `variance` DECIMAL(15, 2) NULL,
    `reconciled_at` DATETIME(3) NULL,
    `reconciled_by` CHAR(36) NULL,
    `status` ENUM('OPEN', 'CLOSED') NOT NULL DEFAULT 'OPEN',

    INDEX `pos_sessions_user_id_idx`(`user_id`),
    INDEX `pos_sessions_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pos_transactions` (
    `id` CHAR(36) NOT NULL,
    `session_id` CHAR(36) NOT NULL,
    `order_id` CHAR(36) NOT NULL,
    `total` DECIMAL(15, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `pos_transactions_order_id_key`(`order_id`),
    INDEX `pos_transactions_session_id_idx`(`session_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accounts` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `code` VARCHAR(50) NOT NULL,
    `type` ENUM('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE') NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `accounts_code_key`(`code`),
    INDEX `accounts_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `journal_entries` (
    `id` CHAR(36) NOT NULL,
    `reference_type` ENUM('ORDER', 'PURCHASE', 'INVENTORY', 'ADJUSTMENT', 'PAYMENT') NOT NULL,
    `reference_id` VARCHAR(255) NOT NULL,
    `event_key` VARCHAR(255) NULL,
    `description` VARCHAR(500) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `journal_entries_event_key_key`(`event_key`),
    INDEX `journal_entries_reference_type_reference_id_idx`(`reference_type`, `reference_id`),
    INDEX `journal_entries_created_at_idx`(`created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `journal_lines` (
    `id` CHAR(36) NOT NULL,
    `journal_entry_id` CHAR(36) NOT NULL,
    `account_id` CHAR(36) NOT NULL,
    `debit` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `credit` DECIMAL(15, 2) NOT NULL DEFAULT 0,

    INDEX `journal_lines_journal_entry_id_idx`(`journal_entry_id`),
    INDEX `journal_lines_account_id_idx`(`account_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ledger_balances` (
    `id` CHAR(36) NOT NULL,
    `account_id` CHAR(36) NOT NULL,
    `period` DATE NOT NULL,
    `balance` DECIMAL(15, 2) NOT NULL,

    INDEX `ledger_balances_account_id_period_idx`(`account_id`, `period`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `suppliers` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `phone` VARCHAR(50) NULL,
    `email` VARCHAR(255) NULL,
    `address` TEXT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `suppliers_name_idx`(`name`),
    INDEX `suppliers_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_orders` (
    `id` CHAR(36) NOT NULL,
    `supplier_id` CHAR(36) NOT NULL,
    `status` ENUM('DRAFT', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `subtotal` DECIMAL(15, 2) NOT NULL,
    `tax` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `total` DECIMAL(15, 2) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `purchase_orders_supplier_id_idx`(`supplier_id`),
    INDEX `purchase_orders_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_order_items` (
    `id` CHAR(36) NOT NULL,
    `purchase_order_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `stock_item_id` CHAR(36) NULL,
    `unit_id` CHAR(36) NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `base_quantity` DECIMAL(20, 8) NULL,
    `received_quantity` DECIMAL(15, 3) NOT NULL DEFAULT 0,
    `unit_cost` DECIMAL(15, 2) NOT NULL,
    `total_cost` DECIMAL(15, 2) NOT NULL,

    INDEX `purchase_order_items_purchase_order_id_idx`(`purchase_order_id`),
    INDEX `purchase_order_items_product_id_idx`(`product_id`),
    INDEX `purchase_order_items_stock_item_id_idx`(`stock_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `goods_receipts` (
    `id` CHAR(36) NOT NULL,
    `request_key` VARCHAR(255) NULL,
    `purchase_order_id` CHAR(36) NOT NULL,
    `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `received_by` CHAR(36) NOT NULL,

    UNIQUE INDEX `goods_receipts_request_key_key`(`request_key`),
    INDEX `goods_receipts_purchase_order_id_idx`(`purchase_order_id`),
    INDEX `goods_receipts_received_by_idx`(`received_by`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `goods_receipt_items` (
    `id` CHAR(36) NOT NULL,
    `goods_receipt_id` CHAR(36) NOT NULL,
    `product_id` CHAR(36) NOT NULL,
    `stock_item_id` CHAR(36) NULL,
    `unit_id` CHAR(36) NULL,
    `quantity` DECIMAL(15, 3) NOT NULL,
    `base_quantity` DECIMAL(20, 8) NULL,
    `unit_cost` DECIMAL(15, 2) NOT NULL,
    `batch_code` VARCHAR(100) NULL,
    `expiry_date` DATETIME(3) NULL,

    INDEX `goods_receipt_items_goods_receipt_id_idx`(`goods_receipt_id`),
    INDEX `goods_receipt_items_product_id_idx`(`product_id`),
    INDEX `goods_receipt_items_stock_item_id_idx`(`stock_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_invoices` (
    `id` CHAR(36) NOT NULL,
    `supplier_id` CHAR(36) NOT NULL,
    `purchase_order_id` CHAR(36) NOT NULL,
    `total_amount` DECIMAL(15, 2) NOT NULL,
    `status` ENUM('UNPAID', 'PARTIAL', 'PAID') NOT NULL DEFAULT 'UNPAID',

    INDEX `supplier_invoices_supplier_id_idx`(`supplier_id`),
    INDEX `supplier_invoices_purchase_order_id_idx`(`purchase_order_id`),
    INDEX `supplier_invoices_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_payments` (
    `id` CHAR(36) NOT NULL,
    `supplier_invoice_id` CHAR(36) NOT NULL,
    `amount` DECIMAL(15, 2) NOT NULL,
    `payment_method` ENUM('CASH', 'CARD', 'TRANSFER', 'ONLINE', 'QR_MANUAL') NOT NULL,
    `payment_date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `supplier_payments_supplier_invoice_id_idx`(`supplier_invoice_id`),
    INDEX `supplier_payments_payment_date_idx`(`payment_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_roles` ADD CONSTRAINT `user_roles_role_id_fkey` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `categories` ADD CONSTRAINT `categories_parent_id_fkey` FOREIGN KEY (`parent_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_category_id_fkey` FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_variants` ADD CONSTRAINT `product_variants_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_images` ADD CONSTRAINT `product_images_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_attributes` ADD CONSTRAINT `product_attributes_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_prices` ADD CONSTRAINT `product_prices_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_prices` ADD CONSTRAINT `product_prices_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `attribute_definition_options` ADD CONSTRAINT `attribute_definition_options_definition_id_fkey` FOREIGN KEY (`definition_id`) REFERENCES `attribute_definitions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_attribute_assignments` ADD CONSTRAINT `product_attribute_assignments_definition_id_fkey` FOREIGN KEY (`definition_id`) REFERENCES `attribute_definitions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_attribute_assignments` ADD CONSTRAINT `product_attribute_assignments_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_attribute_assignments` ADD CONSTRAINT `product_attribute_assignments_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `unit_definitions` ADD CONSTRAINT `unit_definitions_measurement_group_id_fkey` FOREIGN KEY (`measurement_group_id`) REFERENCES `measurement_groups`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_items` ADD CONSTRAINT `stock_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_items` ADD CONSTRAINT `stock_items_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_items` ADD CONSTRAINT `stock_items_base_unit_id_fkey` FOREIGN KEY (`base_unit_id`) REFERENCES `unit_definitions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_item_configurations` ADD CONSTRAINT `stock_item_configurations_stock_item_id_fkey` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_item_identifier_rules` ADD CONSTRAINT `stock_item_identifier_rules_stock_item_id_fkey` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_item_identifier_rules` ADD CONSTRAINT `stock_item_identifier_rules_identifier_type_id_fkey` FOREIGN KEY (`identifier_type_id`) REFERENCES `inventory_identifier_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_item_units` ADD CONSTRAINT `stock_item_units_stock_item_id_fkey` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_item_units` ADD CONSTRAINT `stock_item_units_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `unit_definitions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_item_unit_conversions` ADD CONSTRAINT `stock_item_unit_conversions_stock_item_id_fkey` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_item_unit_conversions` ADD CONSTRAINT `stock_item_unit_conversions_from_unit_id_fkey` FOREIGN KEY (`from_unit_id`) REFERENCES `unit_definitions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_item_unit_conversions` ADD CONSTRAINT `stock_item_unit_conversions_to_unit_id_fkey` FOREIGN KEY (`to_unit_id`) REFERENCES `unit_definitions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_items` ADD CONSTRAINT `inventory_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_items` ADD CONSTRAINT `inventory_items_stock_item_id_fkey` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_batches` ADD CONSTRAINT `inventory_batches_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_batches` ADD CONSTRAINT `inventory_batches_stock_item_id_fkey` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_stock_item_id_fkey` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_movements` ADD CONSTRAINT `inventory_movements_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `unit_definitions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_reservations` ADD CONSTRAINT `inventory_reservations_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_reservations` ADD CONSTRAINT `inventory_reservations_stock_item_id_fkey` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_reservations` ADD CONSTRAINT `inventory_reservations_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `unit_definitions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_serials` ADD CONSTRAINT `inventory_serials_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_serials` ADD CONSTRAINT `inventory_serials_stock_item_id_fkey` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_serials` ADD CONSTRAINT `inventory_serials_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `inventory_assets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_assets` ADD CONSTRAINT `inventory_assets_stock_item_id_fkey` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_assets` ADD CONSTRAINT `inventory_assets_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `inventory_batches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_asset_identifiers` ADD CONSTRAINT `inventory_asset_identifiers_asset_id_fkey` FOREIGN KEY (`asset_id`) REFERENCES `inventory_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_asset_identifiers` ADD CONSTRAINT `inventory_asset_identifiers_identifier_type_id_fkey` FOREIGN KEY (`identifier_type_id`) REFERENCES `inventory_identifier_types`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `barcode_registry` ADD CONSTRAINT `barcode_registry_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `barcode_registry` ADD CONSTRAINT `barcode_registry_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `barcode_registry` ADD CONSTRAINT `barcode_registry_stock_item_id_fkey` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `barcode_registry` ADD CONSTRAINT `barcode_registry_stock_item_unit_id_fkey` FOREIGN KEY (`stock_item_unit_id`) REFERENCES `stock_item_units`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `barcode_registry` ADD CONSTRAINT `barcode_registry_inventory_asset_id_fkey` FOREIGN KEY (`inventory_asset_id`) REFERENCES `inventory_assets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `barcode_registry` ADD CONSTRAINT `barcode_registry_inventory_batch_id_fkey` FOREIGN KEY (`inventory_batch_id`) REFERENCES `inventory_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_transformation_lines` ADD CONSTRAINT `inventory_transformation_lines_transformation_id_fkey` FOREIGN KEY (`transformation_id`) REFERENCES `inventory_transformations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_transformation_lines` ADD CONSTRAINT `inventory_transformation_lines_stock_item_id_fkey` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `inventory_transformation_lines` ADD CONSTRAINT `inventory_transformation_lines_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `unit_definitions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customers` ADD CONSTRAINT `customers_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_addresses` ADD CONSTRAINT `customer_addresses_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_tag_map` ADD CONSTRAINT `customer_tag_map_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_tag_map` ADD CONSTRAINT `customer_tag_map_tag_id_fkey` FOREIGN KEY (`tag_id`) REFERENCES `customer_tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_notes` ADD CONSTRAINT `customer_notes_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_notes` ADD CONSTRAINT `customer_notes_created_by_fkey` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `customer_activities` ADD CONSTRAINT `customer_activities_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversation_participants` ADD CONSTRAINT `conversation_participants_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_conversation_id_fkey` FOREIGN KEY (`conversation_id`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_rules` ADD CONSTRAINT `workflow_rules_workflow_id_fkey` FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_executions` ADD CONSTRAINT `workflow_executions_workflow_id_fkey` FOREIGN KEY (`workflow_id`) REFERENCES `workflows`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `workflow_logs` ADD CONSTRAINT `workflow_logs_execution_id_fkey` FOREIGN KEY (`execution_id`) REFERENCES `workflow_executions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_requests` ADD CONSTRAINT `ai_requests_provider_id_fkey` FOREIGN KEY (`provider_id`) REFERENCES `ai_providers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_stock_item_id_fkey` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_items` ADD CONSTRAINT `order_items_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `unit_definitions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_refund_of_payment_id_fkey` FOREIGN KEY (`refund_of_payment_id`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_merchant_payment_configuration_id_fkey` FOREIGN KEY (`merchant_payment_configuration_id`) REFERENCES `merchant_payment_configurations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `carts` ADD CONSTRAINT `carts_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_cart_id_fkey` FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_stock_item_id_fkey` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_variant_id_fkey` FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `cart_items` ADD CONSTRAINT `cart_items_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `unit_definitions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_proofs` ADD CONSTRAINT `payment_proofs_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_proofs` ADD CONSTRAINT `payment_proofs_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_proofs` ADD CONSTRAINT `payment_proofs_uploaded_by_user_id_fkey` FOREIGN KEY (`uploaded_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_proofs` ADD CONSTRAINT `payment_proofs_reviewed_by_user_id_fkey` FOREIGN KEY (`reviewed_by_user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_provider_sessions` ADD CONSTRAINT `payment_provider_sessions_payment_id_fkey` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_provider_sessions` ADD CONSTRAINT `payment_provider_sessions_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_sessions` ADD CONSTRAINT `pos_sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_transactions` ADD CONSTRAINT `pos_transactions_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `pos_sessions`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pos_transactions` ADD CONSTRAINT `pos_transactions_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_lines` ADD CONSTRAINT `journal_lines_journal_entry_id_fkey` FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entries`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `journal_lines` ADD CONSTRAINT `journal_lines_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_balances` ADD CONSTRAINT `ledger_balances_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_orders` ADD CONSTRAINT `purchase_orders_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_purchase_order_id_fkey` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_stock_item_id_fkey` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_items` ADD CONSTRAINT `purchase_order_items_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `unit_definitions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goods_receipts` ADD CONSTRAINT `goods_receipts_purchase_order_id_fkey` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goods_receipts` ADD CONSTRAINT `goods_receipts_received_by_fkey` FOREIGN KEY (`received_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goods_receipt_items` ADD CONSTRAINT `goods_receipt_items_goods_receipt_id_fkey` FOREIGN KEY (`goods_receipt_id`) REFERENCES `goods_receipts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goods_receipt_items` ADD CONSTRAINT `goods_receipt_items_product_id_fkey` FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goods_receipt_items` ADD CONSTRAINT `goods_receipt_items_stock_item_id_fkey` FOREIGN KEY (`stock_item_id`) REFERENCES `stock_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `goods_receipt_items` ADD CONSTRAINT `goods_receipt_items_unit_id_fkey` FOREIGN KEY (`unit_id`) REFERENCES `unit_definitions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_invoices` ADD CONSTRAINT `supplier_invoices_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_invoices` ADD CONSTRAINT `supplier_invoices_purchase_order_id_fkey` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_orders`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_payments` ADD CONSTRAINT `supplier_payments_supplier_invoice_id_fkey` FOREIGN KEY (`supplier_invoice_id`) REFERENCES `supplier_invoices`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

