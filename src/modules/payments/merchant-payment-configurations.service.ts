import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';

import { MerchantPaymentProviderName } from '../../../generated/prisma/enums';
import {
  sanitizeStorageFilename,
  validateUploadedFile,
} from '../../common/utils/upload-validation.util';
import { MinioService } from '../../infrastructure/minio/minio.service';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

type UploadedFile = {
  buffer: Buffer;
  originalname: string;
  size: number;
  mimetype: string;
};

type UpsertMerchantPaymentConfigurationInput = {
  providerName: MerchantPaymentProviderName;
  countryCode: string;
  accountName: string;
  accountNumber: string;
  isActive?: boolean;
  file?: UploadedFile;
};

const merchantPaymentConfigurationSelect = {
  id: true,
  providerName: true,
  countryCode: true,
  accountName: true,
  accountNumber: true,
  qrImageFileId: true,
  qrImageBucket: true,
  qrImageObjectName: true,
  qrImageContentType: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class MerchantPaymentConfigurationsService {
  private readonly allowedMimeTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
  ]);
  private readonly allowedExtensions = ['.jpg', '.jpeg', '.png', '.webp'];
  private readonly maxFileSizeBytes = 10 * 1024 * 1024;

  constructor(
    private readonly prisma: PrismaService,
    private readonly minioService: MinioService,
    private readonly configService: ConfigService,
  ) {}

  async list() {
    const configurations =
      await this.prisma.merchantPaymentConfiguration.findMany({
        orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
        select: merchantPaymentConfigurationSelect,
      });

    return Promise.all(
      configurations.map((entry) => this.mapConfiguration(entry)),
    );
  }

  async create(input: UpsertMerchantPaymentConfigurationInput) {
    if (!input.file) {
      throw new BadRequestException('QR image file is required');
    }

    this.validateFile(input.file);

    const upload = await this.uploadQrImage(input.file);
    const configuration = await this.prisma.merchantPaymentConfiguration.create(
      {
        data: {
          providerName: input.providerName,
          countryCode: this.normalizeCountryCode(input.countryCode),
          accountName: this.normalizeText(input.accountName),
          accountNumber: this.normalizeText(input.accountNumber),
          isActive: input.isActive ?? true,
          qrImageFileId: upload.fileId,
          qrImageBucket: upload.bucket,
          qrImageObjectName: upload.objectName,
          qrImageContentType: input.file.mimetype,
        },
        select: merchantPaymentConfigurationSelect,
      },
    );

    return this.mapConfiguration(configuration);
  }

  async update(id: string, input: UpsertMerchantPaymentConfigurationInput) {
    const existing = await this.prisma.merchantPaymentConfiguration.findUnique({
      where: { id },
      select: merchantPaymentConfigurationSelect,
    });

    if (!existing) {
      throw new NotFoundException('Merchant payment configuration not found');
    }

    let upload:
      | {
          fileId: string;
          bucket: string;
          objectName: string;
        }
      | undefined;

    if (input.file) {
      this.validateFile(input.file);
      upload = await this.uploadQrImage(input.file);
    }

    const updated = await this.prisma.merchantPaymentConfiguration.update({
      where: { id },
      data: {
        providerName: input.providerName,
        countryCode: this.normalizeCountryCode(input.countryCode),
        accountName: this.normalizeText(input.accountName),
        accountNumber: this.normalizeText(input.accountNumber),
        isActive: input.isActive ?? existing.isActive,
        ...(upload
          ? {
              qrImageFileId: upload.fileId,
              qrImageBucket: upload.bucket,
              qrImageObjectName: upload.objectName,
              qrImageContentType: input.file!.mimetype,
            }
          : {}),
      },
      select: merchantPaymentConfigurationSelect,
    });

    if (upload) {
      await this.deleteObjectSilently(
        existing.qrImageBucket,
        existing.qrImageObjectName,
      );
    }

    return this.mapConfiguration(updated);
  }

  async resolveActiveConfiguration() {
    const configuration =
      await this.prisma.merchantPaymentConfiguration.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' },
        select: merchantPaymentConfigurationSelect,
      });

    if (!configuration) {
      return null;
    }

    return this.mapConfiguration(configuration);
  }

  async getQrImageUrl(bucket: string, objectName: string) {
    return this.minioService.getSignedUrl(bucket, objectName);
  }

  private async mapConfiguration(
    configuration: typeof merchantPaymentConfigurationSelect extends infer _
      ? {
          id: string;
          providerName: MerchantPaymentProviderName;
          countryCode: string;
          accountName: string;
          accountNumber: string;
          qrImageFileId: string;
          qrImageBucket: string;
          qrImageObjectName: string;
          qrImageContentType: string;
          isActive: boolean;
          createdAt: Date;
          updatedAt: Date;
        }
      : never,
  ) {
    return {
      id: configuration.id,
      providerName: configuration.providerName,
      countryCode: configuration.countryCode,
      accountName: configuration.accountName,
      accountNumber: configuration.accountNumber,
      qrImageFileId: configuration.qrImageFileId,
      qrImageUrl: await this.minioService.getSignedUrl(
        configuration.qrImageBucket,
        configuration.qrImageObjectName,
      ),
      isActive: configuration.isActive,
    };
  }

  private async uploadQrImage(file: UploadedFile) {
    const bucket = this.qrImageBucket();
    const fileId = randomUUID();
    const objectName = `merchant-payment-qr/${fileId}-${this.sanitizeFilename(file.originalname)}`;

    await this.minioService.upload({
      bucket,
      objectName,
      data: file.buffer,
      size: file.size,
      contentType: file.mimetype,
    });

    return {
      fileId,
      bucket,
      objectName,
    };
  }

  private async deleteObjectSilently(bucket: string, objectName: string) {
    try {
      await this.minioService.delete(bucket, objectName);
    } catch {
      // Keep the configuration update successful even if the stale object cleanup fails.
    }
  }

  private validateFile(file: UploadedFile) {
    validateUploadedFile(file, {
      allowedExtensions: this.allowedExtensions,
      allowedMimeTypes: [...this.allowedMimeTypes],
      maxFileSizeBytes: this.maxFileSizeBytes,
      fieldLabel: 'QR image',
    });
  }

  private normalizeText(value: string) {
    return value.trim();
  }

  private normalizeCountryCode(value: string) {
    return value.trim().toUpperCase();
  }

  private qrImageBucket() {
    return (
      this.configService.get<string>('MINIO_PAYMENT_QR_BUCKET') ??
      this.configService.getOrThrow<string>('MINIO_BUCKET')
    );
  }

  private sanitizeFilename(filename: string) {
    return sanitizeStorageFilename(filename);
  }
}
