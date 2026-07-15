ALTER TABLE `support_tickets`
  ADD COLUMN `guest_name` VARCHAR(120) NULL,
  ADD COLUMN `guest_email` VARCHAR(255) NULL;

CREATE INDEX `support_tickets_guest_email_created_at_idx`
  ON `support_tickets` (`guest_email`, `created_at`);
