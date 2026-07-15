import {
  BadRequestException,
  ConflictException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsOptional, IsString } from 'class-validator';

import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { Roles } from '../../modules/auth/decorators/roles.decorator';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import {
  sanitizeStorageFilename,
  validateUploadedFile,
} from '../../common/utils/upload-validation.util';
import { MinioService } from './minio.service';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';
import { PrismaService } from '../prisma/prisma.service';

class FileObjectDto {
  @ApiProperty()
  @IsString()
  objectName!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  bucket?: string;
}

@ApiTags('Files')
@Controller('files')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager')
export class FileController {
  private readonly maxFileSizeBytes = 10 * 1024 * 1024;
  private readonly allowedMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
  ];
  private readonly allowedExtensions = [
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.pdf',
  ];

  constructor(
    private readonly minioService: MinioService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @ApiCreatedResponse({
    description: 'Created successfully',
    type: ApiSuccessResponseDto,
  })
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  async upload(
    @UploadedFile()
    file: {
      buffer: Buffer;
      originalname: string;
      size: number;
      mimetype: string;
    },
    @Body() dto: FileObjectDto,
  ) {
    validateUploadedFile(file, {
      allowedExtensions: this.allowedExtensions,
      allowedMimeTypes: this.allowedMimeTypes,
      maxFileSizeBytes: this.maxFileSizeBytes,
      fieldLabel: 'Upload',
    });

    const objectName = this.resolveObjectName(
      dto.objectName,
      file.originalname,
    );

    const bucket = this.bucket(dto.bucket);
    const existing = await this.prisma.fileObject.findUnique({
      where: { objectName },
    });
    if (existing) {
      throw new ConflictException('A file with this object name already exists');
    }
    await this.minioService.upload({
      bucket,
      objectName,
      data: file.buffer,
      size: file.size,
      contentType: file.mimetype,
    });

    return this.prisma.fileObject.create({
      data: {
        bucket,
        objectName,
        originalFilename: file.originalname,
        contentType: file.mimetype,
        size: file.size,
      },
    });
  }

  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get('signed-url')
  getSignedUrl(@Query() query: FileObjectDto) {
    return this.minioService.getSignedUrl(
      this.bucket(query.bucket),
      query.objectName,
    );
  }

  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const file = await this.prisma.fileObject.findUniqueOrThrow({ where: { id } });
    return {
      ...file,
      url: await this.minioService.getSignedUrl(file.bucket, file.objectName),
    };
  }

  @ApiOkResponse({ description: 'Deleted successfully', type: ApiSuccessResponseDto })
  @Delete(':id')
  async deleteById(@Param('id', ParseUUIDPipe) id: string) {
    const file = await this.prisma.fileObject.findUniqueOrThrow({ where: { id } });
    await this.minioService.delete(file.bucket, file.objectName);
    await this.prisma.fileObject.delete({ where: { id } });
    return { success: true, message: 'File deleted successfully' };
  }

  @ApiOkResponse({ description: 'Success', type: ApiSuccessResponseDto })
  @Delete()
  delete(@Query() query: FileObjectDto) {
    return this.minioService.delete(
      this.bucket(query.bucket),
      query.objectName,
    );
  }

  private bucket(bucket?: string) {
    const configuredBucket =
      this.configService.getOrThrow<string>('MINIO_BUCKET');

    if (bucket && bucket !== configuredBucket) {
      throw new BadRequestException('Unsupported storage bucket');
    }

    return configuredBucket;
  }

  private resolveObjectName(
    requestedObjectName: string | undefined,
    originalName: string,
  ) {
    const preferredName = requestedObjectName?.trim() || originalName;
    const extension =
      originalName.lastIndexOf('.') >= 0
        ? originalName.slice(originalName.lastIndexOf('.'))
        : '';
    const baseName =
      preferredName.lastIndexOf('.') >= 0
        ? preferredName.slice(0, preferredName.lastIndexOf('.'))
        : preferredName;

    return `${sanitizeStorageFilename(baseName)}${extension.toLowerCase()}`;
  }
}
