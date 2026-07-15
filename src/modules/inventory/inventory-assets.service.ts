import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { Prisma } from '../../../generated/prisma/client';
import {
  InventoryAssetStatus,
  InventorySerialStatus,
} from '../../../generated/prisma/enums';
import { InventoryTransaction } from './inventory.repository';
import { AuditService } from '../audit/audit.service';
import { StockItemConfigurationService } from './stock-item-configuration.service';
import { StockItemsService } from './stock-items.service';
import { InventoryAssetsRepository } from './inventory-assets.repository';

export type InventoryAssetIdentifierInput = {
  identifierTypeId?: string;
  typeCode?: string;
  value: string;
  isPrimary?: boolean;
};

export type InventoryAssetInput = {
  assetTag?: string;
  identifiers: InventoryAssetIdentifierInput[];
};

type ResolvedIdentifierType = {
  id: string;
  code: string;
  name: string;
  validationRegex: string | null;
  isActive: boolean;
};

@Injectable()
export class InventoryAssetsService {
  constructor(
    private readonly inventoryAssetsRepository: InventoryAssetsRepository,
    private readonly stockItemsService: StockItemsService,
    private readonly stockItemConfigurationService: StockItemConfigurationService,
    private readonly auditService: AuditService,
  ) {}

  async createIdentifierType(input: {
    code: string;
    name: string;
    description?: string;
    validationRegex?: string;
  }) {
    const code = this.normalizeCode(input.code);
    const existing =
      await this.inventoryAssetsRepository.findIdentifierTypeByCode(code);

    if (existing) {
      return existing;
    }

    return this.inventoryAssetsRepository.createIdentifierType({
      id: randomUUID(),
      code,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      validationRegex: input.validationRegex?.trim() || null,
    });
  }

  async validateReceiptAssets(input: {
    stockItemId: string;
    quantity: Prisma.Decimal;
    assets?: InventoryAssetInput[];
  }) {
    const config =
      await this.stockItemConfigurationService.getEffectiveConfiguration(
        input.stockItemId,
      );
    const assets = input.assets ?? [];

    if (!config.trackUniqueAssets) {
      return [];
    }

    const quantityAsNumber = Number(input.quantity.toString());

    if (
      !Number.isSafeInteger(quantityAsNumber) ||
      quantityAsNumber !== assets.length
    ) {
      throw new BadRequestException(
        'Unique asset tracked stock items require one asset per unit received',
      );
    }

    return Promise.all(
      assets.map((asset) =>
        this.normalizeAndValidateAssetInput(config.stockItemId, asset),
      ),
    );
  }

  async resolveSaleAssetIds(input: {
    productId: string;
    stockItemId: string;
    quantity: Prisma.Decimal;
    assetIds?: string[];
    serialNumbers?: string[];
  }) {
    const quantityAsNumber = Number(input.quantity.toString());

    if (!Number.isSafeInteger(quantityAsNumber)) {
      throw new BadRequestException(
        'Unique asset tracked stock items require whole-unit quantities',
      );
    }

    let assetIds = this.normalizeDistinctValues(input.assetIds);

    if (!assetIds.length && input.serialNumbers?.length) {
      const serialRecords =
        await this.inventoryAssetsRepository.findAssetsBySerialNumbers(
          input.productId,
          input.stockItemId,
          input.serialNumbers,
        );

      assetIds = this.normalizeDistinctValues(
        serialRecords
          .map((serialRecord) => serialRecord.asset?.id)
          .filter((value): value is string => Boolean(value)),
      );
    }

    if (assetIds.length !== quantityAsNumber) {
      throw new BadRequestException(
        'Unique asset tracked stock items require one asset per unit sold',
      );
    }

    const assets = await this.inventoryAssetsRepository.findAssetsByIds(assetIds);

    if (assets.length !== assetIds.length) {
      throw new NotFoundException('One or more selected assets were not found');
    }

    for (const asset of assets) {
      if (asset.stockItemId !== input.stockItemId) {
        throw new BadRequestException(
          'Selected asset does not belong to the resolved stock item',
        );
      }

      if (asset.status !== InventoryAssetStatus.AVAILABLE) {
        throw new ConflictException('One or more selected assets are unavailable');
      }
    }

    return assetIds;
  }

  async registerAsset(
    input: {
      stockItemId: string;
      batchId?: string | null;
      assetTag?: string;
      identifiers: InventoryAssetIdentifierInput[];
    },
    transaction?: InventoryTransaction,
  ) {
    const stockItem = await this.stockItemsService.getById(input.stockItemId);
    this.stockItemsService.ensureTracked(stockItem);

    const normalizedAsset = await this.normalizeAndValidateAssetInput(
      input.stockItemId,
      {
        assetTag: input.assetTag,
        identifiers: input.identifiers,
      },
      transaction,
    );

    const asset = await this.inventoryAssetsRepository.createAsset(
      {
        id: randomUUID(),
        stockItemId: input.stockItemId,
        batchId: input.batchId ?? null,
        assetTag: normalizedAsset.assetTag,
        status: InventoryAssetStatus.AVAILABLE,
      },
      transaction,
    );

    for (const identifier of normalizedAsset.identifiers) {
      await this.inventoryAssetsRepository.createAssetIdentifier(
        {
          id: randomUUID(),
          assetId: asset.id,
          identifierTypeId: identifier.identifierType.id,
          value: identifier.value,
          normalizedValue: identifier.normalizedValue,
          isPrimary: identifier.isPrimary,
        },
        transaction,
      );
    }

    const serialCandidate = this.selectSerialCandidate(normalizedAsset.identifiers);

    if (serialCandidate) {
      await this.inventoryAssetsRepository.createSerial(
        {
          id: randomUUID(),
          productId: stockItem.productId,
          stockItemId: input.stockItemId,
          assetId: asset.id,
          serialNumber: serialCandidate.value,
          status: InventorySerialStatus.AVAILABLE,
        },
        transaction,
      );
    }

    this.auditService.logCreate(
      'INVENTORY_ASSET',
      asset.id,
      {
        stockItemId: asset.stockItemId,
        batchId: asset.batchId,
        assetTag: asset.assetTag,
        status: asset.status,
      },
      {
        identifiers: normalizedAsset.identifiers.map((identifier) => ({
          identifierTypeId: identifier.identifierType.id,
          value: identifier.value,
          isPrimary: identifier.isPrimary,
        })),
      },
    );

    return asset;
  }

  async registerAssetsForReceipt(
    input: {
      stockItemId: string;
      batchId: string;
      quantity: Prisma.Decimal;
      assets?: InventoryAssetInput[];
    },
    transaction: InventoryTransaction,
  ) {
    const assets = await this.validateReceiptAssets(
      {
        stockItemId: input.stockItemId,
        quantity: input.quantity,
        assets: input.assets,
      },
    );

    const createdAssets: Awaited<ReturnType<InventoryAssetsService['registerAsset']>>[] = [];

    for (const asset of assets) {
      createdAssets.push(
        await this.registerAsset(
          {
            stockItemId: input.stockItemId,
            batchId: input.batchId,
            assetTag: asset.assetTag ?? undefined,
            identifiers: asset.identifiers.map((identifier) => ({
              identifierTypeId: identifier.identifierType.id,
              value: identifier.value,
              isPrimary: identifier.isPrimary,
            })),
          },
          transaction,
        ),
      );
    }

    return createdAssets;
  }

  async reserveAssets(
    assetIds: string[],
    transaction: InventoryTransaction,
  ) {
    if (!assetIds.length) {
      return;
    }

    const update = await this.inventoryAssetsRepository.updateAssetStatuses(
      assetIds,
      [InventoryAssetStatus.AVAILABLE],
      InventoryAssetStatus.RESERVED,
      transaction,
    );

    if (update.count !== assetIds.length) {
      throw new ConflictException('One or more selected assets are unavailable');
    }

    assetIds.forEach((assetId) =>
      this.auditService.logAction(
        'RESERVE',
        'INVENTORY_ASSET',
        assetId,
        { status: InventoryAssetStatus.AVAILABLE },
        { status: InventoryAssetStatus.RESERVED },
      ),
    );
  }

  async releaseReservedAssets(
    assetIds: string[],
    transaction: InventoryTransaction,
  ) {
    if (!assetIds.length) {
      return;
    }

    await this.inventoryAssetsRepository.updateAssetStatuses(
      assetIds,
      [InventoryAssetStatus.RESERVED],
      InventoryAssetStatus.AVAILABLE,
      transaction,
    );

    assetIds.forEach((assetId) =>
      this.auditService.logAction(
        'RELEASE',
        'INVENTORY_ASSET',
        assetId,
        { status: InventoryAssetStatus.RESERVED },
        { status: InventoryAssetStatus.AVAILABLE },
      ),
    );
  }

  async markAssetsSold(
    assetIds: string[],
    referenceId: string,
    transaction: InventoryTransaction,
  ) {
    if (!assetIds.length) {
      return;
    }

    const update = await this.inventoryAssetsRepository.updateAssetStatuses(
      assetIds,
      [InventoryAssetStatus.AVAILABLE, InventoryAssetStatus.RESERVED],
      InventoryAssetStatus.SOLD,
      transaction,
    );

    if (update.count !== assetIds.length) {
      throw new ConflictException('One or more selected assets are unavailable');
    }

    await this.inventoryAssetsRepository.updateSerialStatusesByAssetIds(
      assetIds,
      [InventorySerialStatus.AVAILABLE],
      InventorySerialStatus.SOLD,
      transaction,
      referenceId,
    );

    assetIds.forEach((assetId) =>
      this.auditService.logAction(
        'SELL',
        'INVENTORY_ASSET',
        assetId,
        { status: InventoryAssetStatus.RESERVED },
        { status: InventoryAssetStatus.SOLD },
        { referenceId },
      ),
    );
  }

  async restoreAssets(
    assetIds: string[],
    transaction: InventoryTransaction,
  ) {
    if (!assetIds.length) {
      return;
    }

    const update = await this.inventoryAssetsRepository.updateAssetStatuses(
      assetIds,
      [InventoryAssetStatus.SOLD, InventoryAssetStatus.RESERVED],
      InventoryAssetStatus.AVAILABLE,
      transaction,
    );

    if (update.count !== assetIds.length) {
      throw new ConflictException('One or more assets could not be restored');
    }

    await this.inventoryAssetsRepository.updateSerialStatusesByAssetIds(
      assetIds,
      [InventorySerialStatus.SOLD],
      InventorySerialStatus.AVAILABLE,
      transaction,
      null,
    );

    assetIds.forEach((assetId) =>
      this.auditService.logAction(
        'RESTORE',
        'INVENTORY_ASSET',
        assetId,
        { status: InventoryAssetStatus.SOLD },
        { status: InventoryAssetStatus.AVAILABLE },
      ),
    );
  }

  private async normalizeAndValidateAssetInput(
    stockItemId: string,
    asset: InventoryAssetInput,
    transaction?: InventoryTransaction,
  ) {
    const config =
      await this.stockItemConfigurationService.getEffectiveConfiguration(
        stockItemId,
      );

    if (!asset.identifiers.length) {
      throw new BadRequestException('At least one asset identifier is required');
    }

    const resolvedIdentifierTypes = await this.resolveIdentifierTypes(
      asset.identifiers,
      transaction,
    );
    const identifiersByType = new Map<string, Array<{
      identifierType: ResolvedIdentifierType;
      value: string;
      normalizedValue: string;
      isPrimary: boolean;
    }>>();

    for (const identifier of asset.identifiers) {
      const resolvedType = resolvedIdentifierTypes.get(
        this.identifierLookupKey(identifier),
      );

      if (!resolvedType) {
        throw new NotFoundException('Asset identifier type not found');
      }

      if (!resolvedType.isActive) {
        throw new BadRequestException(
          `Identifier type ${resolvedType.code} is archived`,
        );
      }

      const value = identifier.value.trim();

      if (!value) {
        throw new BadRequestException('Asset identifier value is required');
      }

      if (
        resolvedType.validationRegex &&
        !new RegExp(resolvedType.validationRegex).test(value)
      ) {
        throw new BadRequestException(
          `Identifier value does not match validation for ${resolvedType.name}`,
        );
      }

      const normalizedValue = value.toUpperCase();
      const current =
        identifiersByType.get(resolvedType.id) ??
        [];

      current.push({
        identifierType: resolvedType,
        value,
        normalizedValue,
        isPrimary: identifier.isPrimary ?? false,
      });
      identifiersByType.set(resolvedType.id, current);
    }

    for (const rule of config.identifierRules) {
      const identifiers = identifiersByType.get(rule.identifierTypeId) ?? [];

      if (rule.isRequired && identifiers.length === 0) {
        throw new BadRequestException(
          `${rule.name} is required for this stock item`,
        );
      }

      if (identifiers.length < rule.minCount) {
        throw new BadRequestException(
          `${rule.name} requires at least ${rule.minCount} value(s)`,
        );
      }

      if (rule.maxCount !== null && identifiers.length > rule.maxCount) {
        throw new BadRequestException(
          `${rule.name} allows at most ${rule.maxCount} value(s)`,
        );
      }
    }

    return {
      assetTag: asset.assetTag?.trim() || null,
      identifiers: Array.from(identifiersByType.values()).flat(),
    };
  }

  private async resolveIdentifierTypes(
    identifiers: InventoryAssetIdentifierInput[],
    transaction?: InventoryTransaction,
  ) {
    const ids = this.normalizeDistinctValues(
      identifiers
        .map((identifier) => identifier.identifierTypeId?.trim())
        .filter((value): value is string => Boolean(value)),
    );
    const codes = this.normalizeDistinctValues(
      identifiers
        .map((identifier) =>
          identifier.typeCode ? this.normalizeCode(identifier.typeCode) : null,
        )
        .filter((value): value is string => Boolean(value)),
    );
    const [typesById, typesByCode] = await Promise.all([
      ids.length
        ? this.inventoryAssetsRepository.findIdentifierTypesByIds(
            ids,
            transaction,
          )
        : Promise.resolve([]),
      codes.length
        ? this.inventoryAssetsRepository.findIdentifierTypesByCodes(
            codes,
            transaction,
          )
        : Promise.resolve([]),
    ]);
    const lookup = new Map<string, ResolvedIdentifierType>();

    for (const type of [...typesById, ...typesByCode]) {
      lookup.set(`id:${type.id}`, type);
      lookup.set(`code:${type.code}`, type);
    }

    return lookup;
  }

  private identifierLookupKey(identifier: InventoryAssetIdentifierInput) {
    if (identifier.identifierTypeId?.trim()) {
      return `id:${identifier.identifierTypeId.trim()}`;
    }

    if (identifier.typeCode?.trim()) {
      return `code:${this.normalizeCode(identifier.typeCode)}`;
    }

    throw new BadRequestException(
      'Asset identifier typeCode or identifierTypeId is required',
    );
  }

  private selectSerialCandidate(
    identifiers: Array<{
      identifierType: ResolvedIdentifierType;
      value: string;
      isPrimary: boolean;
    }>,
  ) {
    const serialLikeCodes = new Set(['SERIAL', 'SERIAL_NUMBER', 'IMEI']);
    const serialIdentifiers = identifiers.filter((identifier) =>
      serialLikeCodes.has(identifier.identifierType.code),
    );

    if (!serialIdentifiers.length) {
      return null;
    }

    return (
      serialIdentifiers.find((identifier) => identifier.isPrimary) ??
      serialIdentifiers[0]
    );
  }

  private normalizeCode(value: string) {
    const normalized = value.trim().toUpperCase().replace(/\s+/g, '_');

    if (!normalized) {
      throw new BadRequestException('Code is required');
    }

    return normalized;
  }

  private normalizeDistinctValues(values?: Array<string | null | undefined>) {
    return [...new Set((values ?? []).filter((value): value is string => Boolean(value)))];
  }
}
