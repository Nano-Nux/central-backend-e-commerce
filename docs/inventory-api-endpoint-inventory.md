# Inventory API Endpoint Inventory

Source of truth for this document:

- `src/main.ts`
- `src/common/dto/api-success-response.dto.ts`
- `src/modules/shared/dto/pagination-query.dto.ts`
- `src/modules/inventory/inventory-admin.controller.ts`
- `src/modules/inventory/inventory-read.controller.ts`
- `src/modules/inventory/inventory-read.dto.ts`
- `src/modules/inventory/inventory-read.service.ts`
- `src/modules/product/product.controller.ts`
- `src/modules/product/variant.controller.ts`
- `src/modules/product/variant-read.service.ts`
- `src/modules/purchase-orders/purchase-orders.controller.ts`
- `src/modules/goods-receipts/goods-receipts.controller.ts`
- `src/modules/suppliers/suppliers.controller.ts`
- `src/modules/purchase/purchase-read.service.ts`
- `src/modules/pos/pos.controller.ts`
- `src/modules/pos/pos.service.ts`
- `src/modules/storefront/store-catalog.controller.ts`
- `src/modules/storefront/dto/store-catalog.dto.ts`

This is a strict route inventory from the live codebase. Paths below are the real controller paths with the global Nest prefix from `src/main.ts`.

## Base Path

- Global API prefix: `/api`
- Swagger path: `/api/docs`

## Standard Response Envelope

Most authenticated business APIs return:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

Storefront catalog endpoints return the same shape without `message` in most handlers:

```json
{
  "success": true,
  "data": {}
}
```

## Standard Page Pagination Contract

All page-based list endpoints in this document use:

```json
{
  "success": true,
  "message": "Success",
  "data": [],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 0,
    "totalPages": 0,
    "hasNext": false,
    "hasPrevious": false
  }
}
```

Validated pagination query params:

- `page`: integer, minimum `1`, default `1`
- `limit`: integer, minimum `1`, maximum `100`, default `20`

## Auth and Roles

- Inventory admin routes: JWT bearer, roles `Admin` or `Manager`
- Inventory read routes: JWT bearer, roles `Admin`, `Manager`, `Warehouse Staff`, `Sales Agent`, `Accountant`
- Product and variant routes: JWT bearer, roles `Admin` or `Manager`
- Purchase order routes: JWT bearer, roles `Admin`, `Manager`, `Warehouse Staff`, `Accountant`
- Goods receipt routes: JWT bearer, roles `Admin`, `Manager`, `Warehouse Staff`
- Supplier routes: JWT bearer, roles `Admin` or `Manager`
- POS routes: JWT bearer, roles `Admin`, `Manager`, `Sales Agent`
- Storefront catalog routes: public

## 1. Stock Items

### GET `/api/inventory/stock-items`

- Query:
  - `page`
  - `limit`
  - `productId` UUID
  - `variantId` UUID
  - `q` string
  - `isActive` boolean
  - `sortOrder` enum: `asc | desc`
- Response: paginated list
- Item shape:
  - stock item scalar fields from `stockItem`
  - `product`: `{ id, name, sku, isStockTracked }`
  - `variant`: `{ id, name, sku, isActive } | null`
  - `baseUnit`
  - `inventoryItem`
  - `configuration`

### GET `/api/inventory/stock-items/:id`

- Path params:
  - `id` UUID
- Response: single stock item
- Data shape:
  - stock item scalar fields
  - `product`
  - `variant`
  - `baseUnit`
  - `inventoryItem`
  - `configuration`
  - `units[]` with nested `unit`
  - `identifierRules[]` with nested `identifierType`

### GET `/api/inventory/stock-items/:id/summary`

- Path params:
  - `id` UUID
- Response: single stock item plus availability summary
- Data shape:
  - full stock item detail shape from `/inventory/stock-items/:id`
  - `summary`: output of `InventoryService.getAvailability(...)`

### GET `/api/inventory/stock-items/:id/movements`

- Path params:
  - `id` UUID
- Query:
  - `page`
  - `limit`
  - `referenceType` enum `InventoryReferenceType`
  - `from` ISO date string
  - `to` ISO date string
  - `sortOrder` enum `asc | desc`
- Response: paginated list
- Item shape:
  - inventory movement records for the stock item

### GET `/api/inventory/stock-items/:id/batches`

- Path params:
  - `id` UUID
- Query:
  - `page`
  - `limit`
  - `productId` UUID
  - `stockItemId` UUID
  - `batchCode` string
  - `expiresBefore` ISO date string
  - `expiresAfter` ISO date string
  - `sortOrder` enum `asc | desc`
- Response: paginated list
- Item shape:
  - batch scalar fields
  - `product`: `{ id, name, sku }`
  - `stockItem`: `{ id, name, sku }`
  - `assets[]`: `{ id, status }`

### GET `/api/inventory/stock-items/:id/assets`

- Path params:
  - `id` UUID
- Query:
  - `page`
  - `limit`
  - `stockItemId` UUID
  - `batchId` UUID
  - `status` enum `InventoryAssetStatus`
  - `q` string
  - `sortOrder` enum `asc | desc`
- Response: paginated list
- Item shape:
  - asset scalar fields
  - `stockItem` with nested `product` and `variant`
  - `batch`
  - `identifiers[]` with nested `identifierType`
  - `serialRecord`
  - `barcodes[]` active barcodes only

### GET `/api/inventory/stock-items/:id/reservations`

- Path params:
  - `id` UUID
- Query:
  - `page`
  - `limit`
  - `referenceType` enum `InventoryReferenceType`
  - `from` ISO date string
  - `to` ISO date string
  - `sortOrder` enum `asc | desc`
- Response: paginated list
- Item shape:
  - reservation movement records for the stock item

## 2. Stock Item Admin and Configuration

### GET `/api/inventory/admin/stock-items`

- Query:
  - `productId` string
  - `variantId` string
  - `isActive` string parsed as boolean
- Response: non-paginated list

### POST `/api/inventory/admin/stock-items/provision`

- Body:
  - `productId` UUID
  - `variantId` UUID optional
- Response: created stock item

### GET `/api/inventory/admin/stock-items/:stockItemId/configuration`

- Path params:
  - `stockItemId` UUID
- Response: stock item configuration detail

### PATCH `/api/inventory/admin/stock-items/:stockItemId/configuration`

- Path params:
  - `stockItemId` UUID
- Body:
  - `trackBatches` boolean optional
  - `trackExpiry` boolean optional
  - `trackUniqueAssets` boolean optional
  - `trackReservations` boolean optional
  - `allowUnitConversions` boolean optional
  - `allowPackBreaking` boolean optional
  - `allowMultipleBarcodes` boolean optional
  - `trackingMode` enum `StockTrackingMode` optional
  - `baseUnitId` UUID nullable optional
- Response: updated configuration

## 3. Variants

### POST `/api/products/:id/variants`

- Path params:
  - `id` UUID product id
- Body:
  - `name` string
  - `sku` string
  - `barcode` string optional
  - `attributes` object
- Response: created variant

### GET `/api/products/:id/variants`

- Path params:
  - `id` UUID product id
- Query:
  - `page`
  - `limit`
  - `q` string
  - `isActive` boolean
  - `sortOrder` enum `asc | desc`
- Response: paginated list
- Item shape:
  - variant scalar fields
  - `stockItems[]` with nested `inventoryItem`

### PATCH `/api/products/:id/variants/:variantId`

- Path params:
  - `id` UUID product id
  - `variantId` UUID
- Body:
  - `name` string optional
  - `sku` string optional
  - `barcode` string nullable optional
  - `attributes` object optional
- Response: updated variant

### POST `/api/products/:id/variants/:variantId/deactivate`

- Response: deactivated variant

### POST `/api/products/:id/variants/:variantId/reactivate`

- Response: reactivated variant

### DELETE `/api/products/:id/variants/:variantId`

- Response: soft-deleted variant

### GET `/api/variants/:id`

- Path params:
  - `id` UUID
- Response: single variant
- Data shape:
  - variant scalar fields
  - `product`
  - `prices[]`
  - `stockItems[]` with:
    - `inventoryItem`
    - `units[]` with nested `unit`
    - `identifierRules[]` with nested `identifierType`
    - `configuration`
  - `barcodes[]`

### GET `/api/variants/:id/history`

- Query:
  - `page`
  - `limit`
- Response: paginated audit history for entity type `PRODUCT_VARIANT`

### PATCH `/api/variants/:id`

- Body:
  - `name` string optional
  - `sku` string optional
  - `barcode` string nullable optional
- Response: updated variant

### DELETE `/api/variants/:id`

- Response: soft-deleted variant

### GET `/api/variants/:id/inventory`

- Response: single object
- Data shape:
  - `variant`
  - `stockItem`
  - `inventory`

### GET `/api/variants/:id/assets`

- Query:
  - `page`
  - `limit`
  - `status` string
  - `sortOrder` enum `asc | desc`
- Response: paginated list
- Item shape:
  - asset scalar fields
  - `batch`
  - `identifiers[]` with nested `identifierType`

### GET `/api/variants/:id/batches`

- Query:
  - `page`
  - `limit`
- Response: paginated list
- Item shape:
  - batch scalar fields
  - `stockItem`

## 4. Barcode Registry

### GET `/api/inventory/admin/barcodes`

- Query:
  - `ownerType` enum `BarcodeOwnerType`
  - `productId` string
  - `stockItemId` string
  - `q` string
  - `activeOnly` string parsed as boolean
- Response: non-paginated list

### POST `/api/inventory/admin/barcodes`

- Body:
  - `code` string
  - `symbology` string
  - `ownerType` enum `BarcodeOwnerType`
  - `ownerId` string
  - `productId` UUID optional
  - `variantId` UUID optional
  - `stockItemId` UUID optional
  - `stockItemUnitId` UUID optional
  - `inventoryAssetId` UUID optional
  - `inventoryBatchId` UUID optional
  - `isPrimary` boolean optional
- Response: registered barcode

### POST `/api/inventory/admin/barcodes/generate`

- Body: same ownership fields as register barcode, without required `code`
- Response: generated barcode

### GET `/api/inventory/admin/barcodes/lookup`

- Query:
  - `code` string
- Response: barcode resolution result

### POST `/api/inventory/admin/barcodes/:id/primary`

- Response: updated primary barcode

### POST `/api/inventory/admin/barcodes/:id/deactivate`

- Response: deactivated barcode

### POST `/api/inventory/admin/barcodes/:id/activate`

- Response: activated barcode

### POST `/api/inventory/admin/barcodes/:id/replace`

- Body:
  - `code` string
  - `symbology` string optional
  - `makePrimary` boolean optional
- Response: replacement barcode record

### GET `/api/inventory/barcodes`

- Query:
  - `page`
  - `limit`
  - `ownerType` enum `BarcodeOwnerType`
  - `productId` UUID
  - `stockItemId` UUID
  - `q` string
  - `activeOnly` boolean
  - `sortOrder` enum `asc | desc`
- Response: paginated list
- Item shape:
  - barcode scalar fields
  - `product`
  - `variant`
  - `stockItem`
  - `stockItemUnit` with nested `unit`
  - `inventoryAsset`
  - `inventoryBatch`

### GET `/api/inventory/barcodes/:id`

- Response: single barcode with the same relation shape as list

### GET `/api/inventory/barcodes/:id/history`

- Query:
  - `page`
  - `limit`
  - `productId` UUID optional
  - `stockItemId` UUID optional
  - `from` ISO date string optional
  - `to` ISO date string optional
  - `days` integer optional
  - `sortOrder` enum `asc | desc`
- Response: paginated audit history for entity type `BARCODE`

### PATCH `/api/inventory/barcodes/:id`

- Body:
  - `code` string optional
  - `symbology` string optional
  - `isPrimary` boolean optional
- Response: updated barcode

### DELETE `/api/inventory/barcodes/:id`

- Response: same behavior as deactivate

### POST `/api/inventory/barcodes/:id/activate`

- Response: activated barcode

### POST `/api/inventory/barcodes/:id/deactivate`

- Response: deactivated barcode

## 5. Asset Tracking

### GET `/api/inventory/admin/identifier-types`

- Query:
  - `q` string optional
- Response: non-paginated list

### POST `/api/inventory/admin/identifier-types`

- Body:
  - `code` string
  - `name` string
  - `description` string optional
  - `validationRegex` string optional
- Response: created identifier type

### PATCH `/api/inventory/admin/identifier-types/:id`

- Body:
  - `name` string optional
  - `description` string nullable optional
  - `validationRegex` string nullable optional
- Response: updated identifier type

### POST `/api/inventory/admin/identifier-types/:id/archive`

- Response: archived identifier type

### POST `/api/inventory/admin/identifier-types/:id/restore`

- Response: restored identifier type

### GET `/api/inventory/admin/stock-items/:stockItemId/identifier-rules`

- Response: non-paginated list of stock item identifier rules

### POST `/api/inventory/admin/stock-items/:stockItemId/identifier-rules`

- Body:
  - `identifierTypeId` UUID
  - `isRequired` boolean optional
  - `minCount` number optional
  - `maxCount` number nullable optional
- Response: upserted rule

### DELETE `/api/inventory/admin/stock-items/:stockItemId/identifier-rules/:identifierTypeId`

- Response: removed rule

### GET `/api/inventory/assets`

- Query:
  - `page`
  - `limit`
  - `stockItemId` UUID
  - `batchId` UUID
  - `status` enum `InventoryAssetStatus`
  - `q` string
  - `sortOrder` enum `asc | desc`
- Response: paginated list
- Item shape:
  - asset scalar fields
  - `stockItem` with nested `product` and `variant`
  - `batch`
  - `identifiers[]` with nested `identifierType`
  - `serialRecord`
  - `barcodes[]`

### GET `/api/inventory/assets/search`

- Query:
  - all `/inventory/assets` query params
  - `identifier` string optional
- Response: paginated list, same shape as `/inventory/assets`

### GET `/api/inventory/assets/by-identifier/:value`

- Path params:
  - `value` string
- Response: single asset detail

### GET `/api/inventory/assets/:id`

- Response: single asset detail
- Data shape:
  - asset scalar fields
  - `stockItem` with nested `product` and `variant`
  - `batch`
  - `identifiers[]` with nested `identifierType`
  - `serialRecord`
  - `barcodes[]`

### GET `/api/inventory/assets/:id/history`

- Response: non-paginated event timeline array
- Item shape:
  - `type`
  - `at`
  - `details`

### PATCH `/api/inventory/assets/:id`

- Body:
  - `assetTag` string nullable optional
  - `status` enum `InventoryAssetStatus` optional
- Response: updated asset

### POST `/api/inventory/assets/:id/retire`

- Response: asset with status moved to `INACTIVE`

### POST `/api/inventory/assets/:id/reactivate`

- Response: asset with status moved to `AVAILABLE`

## 6. Units and Conversions

### GET `/api/inventory/admin/measurement-groups`

- Response: non-paginated list

### POST `/api/inventory/admin/measurement-groups`

- Body:
  - `code` string
  - `name` string
- Response: created measurement group

### PATCH `/api/inventory/admin/measurement-groups/:id`

- Body:
  - `name` string optional
- Response: updated measurement group

### GET `/api/inventory/admin/units`

- Response: non-paginated list

### POST `/api/inventory/admin/units`

- Body:
  - `code` string
  - `name` string
  - `symbol` string optional
  - `measurementGroupId` UUID optional
  - `allowsDecimal` boolean optional
- Response: created unit

### PATCH `/api/inventory/admin/units/:id`

- Body:
  - `name` string optional
  - `symbol` string nullable optional
  - `measurementGroupId` UUID nullable optional
  - `allowsDecimal` boolean optional
- Response: updated unit

### POST `/api/inventory/admin/stock-item-units`

- Body:
  - `stockItemId` UUID
  - `unitId` UUID
  - `conversionToBase` number
  - `isBaseUnit` boolean optional
  - `isSalesUnit` boolean optional
  - `isPurchaseUnit` boolean optional
  - `allowsFractional` boolean optional
  - `position` number optional
- Response: assigned stock item unit

### GET `/api/inventory/admin/stock-items/:stockItemId/units`

- Response: non-paginated stock item unit list

### POST `/api/inventory/admin/stock-item-conversions`

- Body:
  - `stockItemId` UUID
  - `fromUnitId` UUID
  - `toUnitId` UUID
  - `factor` number
- Response: created stock item conversion

### GET `/api/inventory/admin/stock-items/:stockItemId/conversions`

- Response: non-paginated conversion list for one stock item

### GET `/api/inventory/units`

- Query:
  - `page`
  - `limit`
  - `q` string
  - `measurementGroupId` UUID
  - `sortOrder` enum `asc | desc`
- Response: paginated list
- Item shape:
  - unit scalar fields
  - `measurementGroup`

### GET `/api/inventory/units/:id`

- Response: single unit
- Data shape:
  - unit scalar fields
  - `measurementGroup`
  - `stockItemUnits[]` with nested `stockItem`

### GET `/api/inventory/units/:id/history`

- Query:
  - `page`
  - `limit`
  - `productId` UUID optional
  - `stockItemId` UUID optional
  - `from` ISO date string optional
  - `to` ISO date string optional
  - `days` integer optional
  - `sortOrder` enum `asc | desc`
- Response: paginated audit history for entity type `UNIT`

### GET `/api/inventory/conversions`

- Query:
  - `page`
  - `limit`
  - `stockItemId` UUID
  - `fromUnitId` UUID
  - `toUnitId` UUID
  - `sortOrder` enum `asc | desc`
- Response: paginated list
- Item shape:
  - conversion scalar fields
  - `stockItem`
  - `fromUnit`
  - `toUnit`

### GET `/api/inventory/conversions/:id`

- Response: single conversion with `stockItem`, `fromUnit`, `toUnit`

### GET `/api/inventory/conversions/:id/history`

- Query:
  - `page`
  - `limit`
  - `productId` UUID optional
  - `stockItemId` UUID optional
  - `from` ISO date string optional
  - `to` ISO date string optional
  - `days` integer optional
  - `sortOrder` enum `asc | desc`
- Response: paginated audit history for entity type `STOCK_ITEM_CONVERSION`

## 7. Batch and Expiry

### GET `/api/inventory/batches`

- Query:
  - `page`
  - `limit`
  - `productId` UUID
  - `stockItemId` UUID
  - `batchCode` string
  - `expiresBefore` ISO date string
  - `expiresAfter` ISO date string
  - `sortOrder` enum `asc | desc`
- Response: paginated list
- Item shape:
  - batch scalar fields
  - `product`: `{ id, name, sku }`
  - `stockItem`: `{ id, name, sku }`
  - `assets[]`: `{ id, status }`

### GET `/api/inventory/batches/expired`

- Query: same as `/inventory/batches`
- Response: paginated list, with `expiresBefore` internally forced to current time

### GET `/api/inventory/batches/expiring`

- Query:
  - `page`
  - `limit`
  - `productId` UUID optional
  - `stockItemId` UUID optional
  - `from` ISO date string optional
  - `to` ISO date string optional
  - `days` integer optional
  - `sortOrder` enum `asc | desc`
- Response: paginated list of batches expiring within the next `days` window

### GET `/api/inventory/batches/:id`

- Response: single batch
- Data shape:
  - batch scalar fields
  - `product`
  - `stockItem`
  - `assets[]` with nested `identifiers[]` and `identifierType`

### GET `/api/inventory/batches/:id/movements`

- Query:
  - `page`
  - `limit`
  - `referenceType` enum `InventoryReferenceType`
  - `from` ISO date string
  - `to` ISO date string
  - `sortOrder` enum `asc | desc`
- Response: paginated normalized audit-derived movement list
- Item shape:
  - `id`
  - `action`
  - `createdAt`
  - `batchId`
  - `movementId`
  - `quantity`
  - `unitCost`
  - `details`

## 8. Purchasing

### POST `/api/purchase-orders`

- Body:
  - `CreatePurchaseOrderDto` from `src/modules/purchase/dto/create-purchase-order.dto`
- Response: created purchase order

### GET `/api/purchase-orders`

- Query:
  - `page`
  - `limit`
  - `supplierId` UUID
  - `status` enum `PurchaseOrderStatus`
  - `q` string
  - `sortOrder` enum `asc | desc`
- Response: paginated list
- Item shape:
  - purchase order scalar fields
  - `supplier`
  - `items[]` with `product`, `stockItem`, `unit`
  - `receipts[]`: `{ id, receivedAt }`

### GET `/api/purchase-orders/:id`

- Response: single purchase order
- Data shape:
  - purchase order scalar fields
  - `supplier`
  - `items[]` with `product`, `stockItem`, `unit`
  - `receipts[]` with nested `items`
  - `invoices[]`

### POST `/api/purchase-orders/:id/approve`

- Response: approved purchase order

### POST `/api/purchase-orders/:id/cancel`

- Response: cancelled purchase order

### POST `/api/goods-receipts`

- Body:
  - `CreateGoodsReceiptDto` from `src/modules/purchase/dto/create-goods-receipt.dto`
- Response: created goods receipt

### GET `/api/goods-receipts`

- Query:
  - `page`
  - `limit`
  - `purchaseOrderId` UUID
  - `supplierId` UUID
  - `q` string
  - `sortOrder` enum `asc | desc`
- Response: paginated list
- Item shape:
  - goods receipt scalar fields
  - `purchaseOrder` with nested `supplier`
  - `receiver`
  - `items[]` with `product`, `stockItem`, `unit`

### GET `/api/goods-receipts/:id`

- Response: single goods receipt with the same relation shape as the list detail include

### GET `/api/suppliers/:id/purchase-history`

- Query:
  - `page`
  - `limit`
  - `sortOrder` enum `asc | desc`
- Response: paginated purchase order history for one supplier
- Item shape:
  - purchase order scalar fields
  - `items[]` with `product`, `stockItem`, `unit`
  - `receipts[]` with nested `items`

## 9. POS

### POST `/api/pos/sessions/open`

- Body:
  - `OpenPOSSessionDto` from `src/modules/shared/dto/open-pos-session.dto`
- Response: created session

### POST `/api/pos/sessions/close`

- Body:
  - `ClosePOSSessionDto` from `src/modules/shared/dto/close-pos-session.dto`
- Response: closed session

### GET `/api/pos/sessions`

- Query:
  - `page`
  - `limit`
  - `status` enum `POSSessionStatus`
  - `userId` UUID
  - `sortOrder` enum `asc | desc`
- Response: paginated list
- Item shape:
  - selected session fields from `posSessionSelect`

### GET `/api/pos/sessions/:id`

- Response: single session
- Data shape:
  - session scalar fields
  - `user`
  - `transactions[]` with:
    - `order`
    - `order.items[]`
    - `order.payments[]`

### POST `/api/pos/sales`

- Body:
  - `CreatePOSSaleDto` from `src/modules/shared/dto/create-pos-sale.dto`
- Response: created POS transaction / sale

### GET `/api/pos/sales`

- Query:
  - `page`
  - `limit`
  - `sessionId` UUID
  - `q` string
  - `sortOrder` enum `asc | desc`
- Response: paginated list
- Item shape:
  - POS transaction scalar fields
  - `session`
  - `order` with:
    - `items[]` including `product`, `stockItem`, `variant`, `unit`
    - `payments[]`
    - `customer`

### GET `/api/pos/sales/:id`

- Response: single POS transaction with the same relation shape as `/pos/sales`

## 10. Storefront Catalog Inventory Surface

### GET `/api/store/products`

- Query:
  - `page`
  - `limit`
  - `q` string
  - `category` string
  - `categoryId` string
  - `inStock` boolean
  - `sort` enum `newest | price_asc | price_desc | name_asc | name_desc`
- Response:
  - `success`
  - `data[]`
  - `pagination`
- Item shape:
  - `id`
  - `name`
  - `slug`
  - `shortDescription`
  - `primaryImageUrl`
  - `category`
  - `productType`
  - `price`
  - `stockVisibility`
  - `isFeatured`
  - `createdAt`

### GET `/api/store/products/:slug`

- Response: product detail
- Data shape:
  - card fields from `/store/products`
  - `description`
  - `images[]`
  - `attributes[]`
  - `variants[]`
  - `stockItems[]`

### GET `/api/store/products/:slug/availability`

- Response: single availability object
- Data shape:
  - `productId`
  - `slug`
  - `name`
  - `stockVisibility`
  - `stockItems[]`

### GET `/api/store/products/:slug/variants`

- Response: variant collection
- Item shape:
  - `id`
  - `name`
  - `sku`
  - `barcode`
  - `attributes`
  - `price`
  - `stockVisibility`
  - `stockItemId`

### GET `/api/store/products/:slug/units`

- Response: stock item unit groups
- Item shape:
  - `stockItemId`
  - `variantId`
  - `name`
  - `units[]`

## 11. Inventory Transformations

### POST `/api/inventory/transformations`

- Body:
  - `type` enum `InventoryTransformationType`
  - `referenceId` string optional
  - `notes` string optional
  - `lines[]`
- `lines[]` item body:
  - `unitId` UUID optional
  - `stockItemId` UUID
  - `direction` enum `InventoryTransformationLineDirection`
  - `quantity` number
  - `unitCost` number optional
- Response: created transformation
- Data shape:
  - transformation scalar fields
  - `lines[]`
  - enriched runtime state from `enrichTransformation(...)`

### GET `/api/inventory/transformations`

- Query:
  - `page`
  - `limit`
  - `type` enum `InventoryTransformationType`
  - `q` string
- Response: paginated list
- Item shape:
  - transformation scalar fields
  - `lines[]`
  - enriched runtime state

### GET `/api/inventory/transformations/:id`

- Response: single transformation with `lines[]` and enriched runtime state

### GET `/api/inventory/transformations/:id/history`

- Query:
  - `page`
  - `limit`
  - `productId` UUID optional
  - `stockItemId` UUID optional
  - `from` ISO date string optional
  - `to` ISO date string optional
  - `days` integer optional
  - `sortOrder` enum `asc | desc`
- Response: paginated audit history for entity type `INVENTORY_TRANSFORMATION`

### POST `/api/inventory/transformations/:id/execute`

- Response: executed transformation with generated movements already applied by runtime service

### POST `/api/inventory/transformations/:id/cancel`

- Response: cancelled transformation

## 12. Reporting

### GET `/api/reports/inventory-summary`

- Query:
  - `page`
  - `limit`
  - `productId` UUID optional
  - `stockItemId` UUID optional
  - `from` ISO date string optional
  - `to` ISO date string optional
  - `days` integer optional
  - `sortOrder` enum `asc | desc`
- Response: paginated list
- Item shape:
  - `stockItemId`
  - `productId`
  - `productName`
  - `variantId`
  - `variantName`
  - `quantityOnHand`
  - `reservedQuantity`
  - `availableQuantity`
  - `batchCount`

### GET `/api/reports/inventory-movements`

- Query: same report query shape
- Response: paginated movement list

### GET `/api/reports/inventory-valuation`

- Query: same report query shape
- Response: paginated list
- Item shape:
  - `batchId`
  - `stockItemId`
  - `productId`
  - `productName`
  - `batchCode`
  - `quantityRemaining`
  - `unitCost`
  - `inventoryValue`

### GET `/api/reports/expiring-stock`

- Query: same report query shape
- Response: paginated expiring batch list

### GET `/api/reports/assets`

- Query: same report query shape
- Response: paginated asset list

### GET `/api/reports/purchasing`

- Query: same report query shape
- Response: paginated goods receipt list
- Item shape:
  - goods receipt scalar fields
  - `purchaseOrder` with nested `supplier`
  - `items[]` with `product`, `stockItem`, `unit`

### GET `/api/reports/pos`

- Query: same report query shape
- Response: paginated POS transaction list
- Item shape:
  - POS transaction scalar fields
  - `session`
  - `order` with `items[]`, `payments[]`, `customer`

## 13. Frontend Handoff Notes From Live Code

- All paginated authenticated list endpoints use page-number pagination, not cursor pagination.
- The documented maximum validated `limit` is `100`.
- `/api/inventory/assets/:id/history` is not paginated in the current controller. It returns a timeline array.
- `/api/inventory/admin/*` list endpoints are mostly non-paginated in the current controller surface.
- Storefront catalog endpoints return `success` and `data`, with pagination only on list endpoints.
- The application prefix is `/api`, not `/api/v1`, in the current runtime bootstrap.
