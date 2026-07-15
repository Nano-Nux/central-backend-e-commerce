import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Inventory migration chain', () => {
  it('includes the stock item foundation in the current baseline migration', () => {
    const baselineMigration = readFileSync(
      resolve(
        __dirname,
        '../../../prisma/migrations/20260707143000_reset_baseline/migration.sql',
      ),
      'utf8',
    );

    expect(baselineMigration).toContain('CREATE TABLE `stock_items`');
    expect(baselineMigration).toContain(
      'CREATE TABLE `inventory_identifier_types`',
    );
    expect(baselineMigration).toContain(
      'CREATE TABLE `inventory_transformations`',
    );
    expect(baselineMigration).toContain('CREATE TABLE `inventory_reservations`');
    expect(baselineMigration).toContain('`unit_id` CHAR(36) NULL');
    expect(baselineMigration).toContain('CREATE TABLE `order_items`');
    expect(baselineMigration).toContain('`base_quantity` DECIMAL(20, 8) NULL');
  });
});
