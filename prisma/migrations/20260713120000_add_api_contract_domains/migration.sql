CREATE TABLE `file_objects` (
  `id` CHAR(36) NOT NULL,
  `bucket` VARCHAR(255) NOT NULL,
  `object_name` VARCHAR(512) NOT NULL,
  `original_filename` VARCHAR(255) NOT NULL,
  `content_type` VARCHAR(255) NOT NULL,
  `size` INT NOT NULL,
  `uploaded_by_user_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `file_objects_object_name_key` (`object_name`),
  INDEX `file_objects_uploaded_by_user_id_created_at_idx` (`uploaded_by_user_id`, `created_at`),
  INDEX `file_objects_bucket_created_at_idx` (`bucket`, `created_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `system_settings` (
  `id` CHAR(36) NOT NULL,
  `setting_key` VARCHAR(255) NOT NULL,
  `value_json` JSON NOT NULL,
  `updated_by_user_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `system_settings_setting_key_key` (`setting_key`),
  INDEX `system_settings_updated_at_idx` (`updated_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `webhook_events` (
  `id` CHAR(36) NOT NULL,
  `provider` VARCHAR(50) NOT NULL,
  `external_id` VARCHAR(255) NOT NULL,
  `payload_json` JSON NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'RECEIVED',
  `received_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `processed_at` DATETIME(3) NULL,
  `error_message` VARCHAR(1000) NULL,
  UNIQUE INDEX `webhook_events_provider_external_id_key` (`provider`, `external_id`),
  INDEX `webhook_events_provider_received_at_idx` (`provider`, `received_at`),
  INDEX `webhook_events_status_received_at_idx` (`status`, `received_at`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `support_tickets` (
  `id` CHAR(36) NOT NULL,
  `customer_id` CHAR(36) NULL,
  `subject` VARCHAR(255) NOT NULL,
  `description` TEXT NOT NULL,
  `status` VARCHAR(30) NOT NULL DEFAULT 'OPEN',
  `priority` VARCHAR(30) NOT NULL DEFAULT 'NORMAL',
  `assigned_to_user_id` CHAR(36) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `support_tickets_customer_id_created_at_idx` (`customer_id`, `created_at`),
  INDEX `support_tickets_status_priority_created_at_idx` (`status`, `priority`, `created_at`),
  INDEX `support_tickets_assigned_to_user_id_status_idx` (`assigned_to_user_id`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
