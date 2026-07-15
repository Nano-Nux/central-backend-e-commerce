import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'minio';
import { Readable } from 'stream';

export type UploadObjectInput = {
  bucket: string;
  objectName: string;
  data: Buffer | Readable | string;
  size?: number;
  contentType?: string;
};

@Injectable()
export class MinioService {
  private readonly client: Client;

  constructor(configService: ConfigService) {
    this.client = new Client({
      endPoint: configService.getOrThrow<string>('MINIO_ENDPOINT'),
      port: Number(configService.get<string>('MINIO_PORT') ?? 9000),
      useSSL: configService.get<string>('MINIO_USE_SSL') === 'true',
      accessKey: configService.getOrThrow<string>('MINIO_ACCESS_KEY'),
      secretKey: configService.getOrThrow<string>('MINIO_SECRET_KEY'),
    });
  }

  async upload(input: UploadObjectInput) {
    await this.ensureBucket(input.bucket);

    return this.client.putObject(
      input.bucket,
      input.objectName,
      input.data,
      input.size,
      input.contentType ? { 'Content-Type': input.contentType } : undefined,
    );
  }

  delete(bucket: string, objectName: string) {
    return this.client.removeObject(bucket, objectName);
  }

  getSignedUrl(bucket: string, objectName: string, expiresInSeconds = 3600) {
    return this.client.presignedGetObject(bucket, objectName, expiresInSeconds);
  }

  private async ensureBucket(bucket: string) {
    const exists = await this.client.bucketExists(bucket);

    if (!exists) {
      await this.client.makeBucket(bucket);
    }
  }
}
