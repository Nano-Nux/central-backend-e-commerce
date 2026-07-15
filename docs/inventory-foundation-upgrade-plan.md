# Inventory Foundation Upgrade Plan

## Purpose

This document defines the Phase 1 architecture upgrade plan for the existing `central-backend` project.

It is based on the actual implementation currently present in the repository, not on assumptions.

The goal is to evolve the backend into a configurable commerce inventory platform that supports:

- Fashion
- Cosmetics
- Electronics
- Mobile phones
- Computers
- Books
- Pet stores
- Mini marts
- Small wholesalers
- Pharmacies
- Medical equipment
- Fabric / Longyi
- Coffee / Tea distribution
- Hardware

without hardcoded industry logic and without breaking existing functionality.

---

## Hybrid Stabilization Note

The backend now includes a hybrid inventory consistency layer in live service code:

- inventory writes resolve nullable `stockItemId` before mutation when possible
- legacy `productId` mutation paths remain supported
- inventory movements, reservations, order items, purchase order items, and goods receipt items can carry nullable `stockItemId`, nullable `unitId`, and canonical `baseQuantity`
- barcode resolution is additive and registry-first, with fallback to legacy product and variant barcode fields

This is an additive stabilization step, not a full migration. Product-level inventory ownership still exists in parallel and must remain backward compatible until the later rollout phases are completed.

---

## Source Of Truth Reviewed

The following live implementation areas were inspected:

- `prisma/schema.prisma`
- `src/app.module.ts`
- `src/modules/product/*`
- `src/modules/inventory/*`
- `src/modules/inventory-batch/*`
- `src/modules/inventory-fifo/*`
- `src/modules/orders/*`
- `src/modules/pos/*`
- `src/modules/storefront/*`
- `src/modules/purchase/*`
- `src/modules/purchase-orders/*`
- `src/modules/goods-receipts/*`
- `src/modules/supplier-invoices/*`
- `src/modules/payments/*`
- `src/modules/accounting/*`
- shared DTOs and event payloads used by those modules

---

## 1. Current Architecture

### 1.1 Verified Existing Modules

The backend already contains the following modules and they are wired in `src/app.module.ts`:

- Product
- Category
- Inventory
- Orders
- Payments
- POS
- Purchase
- Accounting
- Storefront
- CRM / Customers
- Audit
- Auth
- Reconciliation

### 1.2 Current Maturity Assessment

#### Product Module

Status: `Implemented, usable, not yet extensible enough`

What exists:

- `products`
- `product_variants`
- `product_attributes`
- `product_prices`
- `product_images`
- category assignment
- base barcode on product and variant
- `isStockTracked`
- `isSerialized`

Limitations:

- no reusable attribute definitions
- no attribute types or validation metadata
- no capability registry table in live schema
- no units or packaging in live schema
- no product-specific conversion rules
- inventory identity is not variant-aware

#### Inventory Module

Status: `Implemented core, production-oriented, still product-centric`

What exists:

- `inventory_items`
- `inventory_movements`
- `inventory_batches`
- `inventory_serials`
- `inventory_reservations`
- stock in / out / reserve / release / adjustment
- FIFO batch consumption
- event-driven order and purchase integration
- audit logging

Limitations:

- all stock is owned by `productId`
- no `variantId` in inventory tables
- no `unitId` in inventory tables
- no entered quantity vs canonical quantity distinction
- no transformation / pack breaking model
- no asset identifier type model
- serials are only plain product-level strings
- batches are product-level only

#### Orders Module

Status: `Implemented core flow`

What exists:

- order creation
- guest and customer support
- serial validation for serialized products
- price resolution through `PricingService`
- event emission for reservation / stock-out / accounting

Limitations:

- order line identity is `productId` + optional `variantId`
- no unit selection per line
- no batch selection per line
- no asset allocation object beyond `serialNumbers` JSON
- no conversion-aware quantity handling

#### POS Module

Status: `Implemented on top of Orders + Payments`

What exists:

- POS sessions
- POS sales
- payment recording
- order reuse

Limitations:

- no unit-aware selling
- no barcode registry lookup
- no asset scan workflow beyond manual serial input carried through order item
- no pack breaking workflow

#### Purchase / Goods Receipt Module

Status: `Implemented core purchasing`

What exists:

- suppliers
- purchase orders
- goods receipts
- supplier invoices
- supplier payments
- stock-in and accounting integration via events

Limitations:

- PO and receipt lines are product-only
- no purchasing unit support
- no unit conversion handling
- no receiving against stock identity other than product
- no asset receiving flow

#### Accounting Module

Status: `Implemented service-driven double-entry core`

What exists:

- order sale
- payment receipt
- COGS
- inventory receipt
- supplier invoice
- supplier payment
- domain-event driven posting

Limitations:

- COGS depends on current inventory allocation shape
- transformations and conversion costing are not modeled
- no valuation logic for unit conversions or asset-specific costing

#### Storefront Module

Status: `Implemented customer/store surface`

What exists:

- catalog listing
- product detail
- cart
- checkout
- guest order access
- payment proof upload flow
- LINE Pay session flow

Limitations:

- catalog and cart use product/variant only
- stock visibility is derived from product-level inventory summary
- no unit-specific pricing or stock visibility
- no barcode-driven lookup

### 1.3 Database Ownership Boundaries Today

#### Product Owns

- catalog metadata
- variants
- images
- freeform attributes
- price rows
- stock flags

#### Inventory Owns

- stock summary
- stock reservations
- stock movements
- FIFO batches
- serialized units

#### Orders Own

- commercial line items
- customer/guest order state

#### Purchase Owns

- suppliers
- purchase orders
- goods receipts
- supplier invoices
- supplier payments

#### Accounting Owns

- journal creation and financial records

### 1.4 Integration Points Verified In Code

- Orders emit order events consumed by Inventory and Accounting.
- Payments update order state and emit payment events consumed by Inventory and Accounting.
- Goods receipts emit purchase receipt events consumed by Inventory and Accounting.
- POS is layered on Orders + Payments.
- Storefront is layered on Orders + Payments + Pricing.
- Inventory is correctly treated as the owner of stock changes.

This is a strong foundation and should be preserved.

---

## 2. Current Problems

### 2.1 Inventory Identity Is Too Narrow

The current inventory identity is effectively:

- `productId`

with optional commercial reference to:

- `variantId`

This is the single biggest structural limitation.

It prevents clean support for:

- variant-specific stock
- product-specific units
- unit conversions
- packaging hierarchies
- batch allocation by sellable form
- asset-level tracking
- pack breaking
- barcode ownership beyond product / variant

### 2.2 Live Schema Lags Behind The Documented Target

The specification documents mention:

- product units
- unit conversions
- packages
- capabilities

but the live Prisma schema does not yet implement those tables.

### 2.3 Barcodes Are Only Flat Strings

Current barcode support is:

- `products.barcode`
- `product_variants.barcode`

This is insufficient for:

- multiple barcodes
- unit barcodes
- asset barcodes
- batch barcodes
- barcode generation
- normalized lookup

### 2.4 Serials Are Not Yet A Full Asset Model

`inventory_serials` exists, but it is still too small for long-term asset tracking:

- no identifier type
- no multiple identifiers per asset
- no custom identifier types
- no asset metadata
- no asset lifecycle beyond available/sold/returned

### 2.5 Units And Packaging Do Not Exist In Transactional Flows

Orders, cart, checkout, POS, purchase orders, and goods receipts all assume:

- one quantity field
- one implicit unit
- no conversion graph

### 2.6 Accounting Will Drift If Conversions Are Added Naively

Current accounting is compatible with the existing movement model, but not with:

- pack breaking
- split/merge transformations
- mixed-unit purchases and sales
- asset-specific costing

without upgrading the movement and allocation shape first.

---

## 3. Recommended Long-Term Inventory Identity

## Decision

Inventory should move to a new additive abstraction:

- `StockItem`

This should become the long-term owner of inventory.

### 3.1 Why Not Product?

`Product` is too abstract. One product can have:

- no inventory
- one stock form
- multiple variants with distinct stock
- multiple selling units
- serialized and non-serialized flows

### 3.2 Why Not Variant Only?

Not every product uses variants.

Also, units, batches, and assets are inventory concerns, not purely catalog concerns.

### 3.3 Why Not Sellable Item?

Sellable identity is useful, but selling and stocking are not always identical:

- one stocked roll can be sold as meter or foot
- one stocked medicine box can be sold as strip or tablet
- one stocked asset can have multiple identifiers

So sellable form should reference stock identity, not replace it.

### 3.4 Recommended Model

Introduce:

- `stock_items`

Each `StockItem` represents one inventory-bearing catalog identity.

In rollout terms:

- a product without variants maps to one stock item
- a product with stock-bearing variants maps to one stock item per variant
- digital/service products may have no stock item

`StockItem` should become the parent for:

- inventory summary
- inventory movements
- inventory reservations
- batches
- assets
- unit assignments
- unit conversions
- transformation rules
- barcode ownership where appropriate

### 3.5 Backward Compatibility Rule

During rollout:

- existing `productId` APIs stay valid
- legacy product-based rows continue to function
- a deterministic mapping from current product/variant to stock item is introduced
- reads should support both legacy and upgraded records
- writes should progressively dual-write

---

## 4. Recommended Target Architecture

### 4.1 Catalog Layer

Keep existing:

- `products`
- `product_variants`
- `product_prices`
- `product_images`

Add:

- `attribute_definitions`
- `attribute_definition_options`
- `product_attribute_values` or equivalent normalized assignment table
- `stock_items`

Notes:

- freeform attributes may remain for compatibility, but the new system should support reusable definitions
- `StockItem` is the inventory-facing bridge between Catalog and Inventory

### 4.2 Units Layer

Add:

- `unit_definitions`
- `unit_measurement_families`
- `stock_item_units`
- `stock_item_unit_conversions`

Required capabilities:

- universal unit definitions
- product-specific enablement
- per-stock-item base unit
- conversion chains
- decimal support
- packaging hierarchies

Examples supported generically:

- Carton -> Box -> Strip -> Tablet
- Roll -> Meter -> Foot
- Bag -> Pack

### 4.3 Inventory Layer

Extend inventory to become stock-item based.

Target ownership:

- `inventory_items.stock_item_id`
- `inventory_movements.stock_item_id`
- `inventory_reservations.stock_item_id`
- `inventory_batches.stock_item_id`

Movement rows should also gain:

- entered unit
- entered quantity
- canonical base quantity

This is necessary so the system can:

- accept user-facing units
- post consistent stock math
- preserve auditability

### 4.4 Asset Tracking Layer

Add:

- `inventory_identifier_types`
- `inventory_assets`
- `inventory_asset_identifiers`

Why:

- IMEI must not be hardcoded
- serial number must not be hardcoded
- license key must not be hardcoded

A business owner should be able to define types such as:

- IMEI
- SERIAL
- LICENSE_KEY
- ENGINE_NUMBER
- CHASSIS_NUMBER
- CUSTOM

Asset tracking belongs under Inventory, not under Product.

### 4.5 Barcode Layer

Add:

- `barcode_registry`

Each barcode row should support:

- normalized code
- display code
- symbology
- owner type
- owner id
- generated vs external
- primary flag
- active flag
- metadata

Supported owners should include:

- product
- variant
- stock item unit
- inventory asset
- inventory batch

### 4.6 Transformation Layer

Add:

- `inventory_transformations`
- `inventory_transformation_lines`

Use cases:

- pack breaking
- repacking
- decomposition
- unit-based splitting

Examples:

- Box -> Strip
- Strip -> Tablet
- Roll -> Meter

This must create real inventory movements and preserve costing.

### 4.7 Transactional Layers To Upgrade

Eventually add stock-item and unit awareness to:

- cart items
- order items
- purchase order items
- goods receipt items
- POS sale creation

The existing product-based columns should remain during transition.

### 4.8 Accounting Layer

Accounting should continue to post from Inventory and Payment events.

But COGS and inventory valuation must evolve to read:

- canonical movement quantities
- movement allocation detail
- transformation cost redistribution

The accounting service boundary should remain unchanged.

---

## 5. Migration Strategy

## 5.1 General Strategy

Use:

- additive schema changes
- dual-read
- dual-write
- compatibility facades

Avoid:

- immediate destructive renames
- hard cutover on existing endpoints
- mixing new stock identity into every module at once

## 5.2 Rollout Shape

### Stage A: Add Foundation

Add new tables and nullable foreign keys without changing existing flows.

### Stage B: Establish Stock Item Mapping

Backfill one `StockItem` per existing inventory-bearing product.

For products that already use variants, define the initial policy:

- either one stock item per product until variant stock is enabled
- or one per variant where the data explicitly requires it

The recommended rollout default is:

- one stock item per product for existing records
- variant stock can be enabled explicitly later

This minimizes disruption.

### Stage C: Dual-Write Core Inventory

Update InventoryService to write legacy product-based fields and new stock-item-based fields.

### Stage D: Upgrade Upstream Transactions

Upgrade:

- orders
- cart
- checkout
- POS
- purchase orders
- goods receipts

to resolve stock items and units while still honoring old request shapes.

### Stage E: Upgrade Reads

Move stock reporting and lookup flows to prefer new data.

### Stage F: Finalize

After validation and reconciliation:

- deprecate legacy-only assumptions
- keep compatibility columns until fully safe to remove in a later program

---

## 6. Rollout Phases

## Phase 1: Architecture And Planning

Deliverables:

- this document
- target inventory identity decision
- rollout design

## Phase 2: Foundational Schema And Domain Layer

Implement:

- `stock_items`
- attribute definition foundation
- unit definition foundation
- stock-item unit assignment/conversion foundation
- identifier type foundation
- asset foundation
- barcode registry foundation
- transformation foundation
- new repositories and domain services

Do not break existing endpoints.

## Phase 3: Inventory Integration

Upgrade:

- InventoryService
- InventoryRepository
- FIFO/batch flows
- reservations
- stock adjustments

Add dual-write and compatibility readers.

## Phase 4: Purchasing Integration

Upgrade:

- purchase order items
- goods receipt items
- receiving flows
- batch receiving
- asset receiving
- unit-aware procurement

## Phase 5: POS Integration

Upgrade:

- barcode lookup
- asset scan/select
- unit-aware selling
- pack breaking support

## Phase 6: Storefront Integration

Upgrade:

- catalog exposure for units and attributes
- cart items
- checkout lines
- stock visibility
- barcode lookup where needed

## Phase 7: Accounting And Costing Integration

Upgrade:

- movement allocation shape
- COGS event payloads
- transformation costing
- inventory valuation consistency

## Phase 8: Migration And Testing Checklist

Deliver:

- backfill checklist
- reconciliation checklist
- rollout checklist
- regression test checklist

---

## 7. Recommended Phase 2 Scope

Phase 2 should stay intentionally narrow.

It should implement only the new foundation and compatibility scaffolding:

- new schema objects
- repository layer
- core domain services
- stock-item resolver
- barcode lookup service
- unit conversion service
- asset registration service

It should not yet attempt a full end-to-end transactional cutover.

That keeps risk manageable and respects the current working system.

---

## 8. Key Design Rules For Implementation

### Rule 1

Do not rewrite the existing product, order, POS, purchase, or accounting modules from scratch.

### Rule 2

Inventory remains the owner of stock logic.

### Rule 3

Accounting remains the owner of journal creation.

### Rule 4

Catalog owns metadata and pricing, not stock movement.

### Rule 5

New architecture must be additive first, replacement second.

### Rule 6

Every new feature must support a configuration-driven path.

That includes:

- attributes
- units
- identifier types
- barcode ownership
- packaging hierarchies

### Rule 7

No hardcoded pharmacy, electronics, or fabric logic.

Everything should come from:

- stock item configuration
- unit assignments
- conversion rules
- capability flags
- identifier types

---

## 9. Recommended Immediate Next Step

Proceed to Phase 2 with a schema/domain foundation centered on:

- `stock_items`
- universal attribute definitions
- universal units
- product/stock-item unit assignments
- unit conversions
- identifier types
- inventory assets
- barcode registry
- transformations

while leaving all existing APIs operational.

---

## 10. Summary Recommendation

The existing backend already contains enough real architecture to evolve safely:

- modular boundaries exist
- inventory ownership is clear
- purchasing, orders, POS, storefront, payments, and accounting already integrate through services and events

The correct long-term move is not to keep extending product-owned inventory.

The correct move is to introduce a new additive `StockItem` inventory identity and progressively migrate the system around it.

This gives the project a path to support:

- configurable units
- configurable packaging
- configurable identifiers
- asset tracking
- barcode registry
- transformation workflows
- industry-agnostic inventory

without repeated future schema redesign.
