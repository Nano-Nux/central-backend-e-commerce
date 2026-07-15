import { BadRequestException } from '@nestjs/common';
import { extname } from 'node:path';

export type UploadedFileLike = {
  buffer?: Buffer;
  originalname: string;
  size: number;
  mimetype: string;
};

export type UploadValidationOptions = {
  allowedExtensions: string[];
  allowedMimeTypes: string[];
  maxFileSizeBytes: number;
  fieldLabel: string;
};

export function validateUploadedFile(
  file: UploadedFileLike | undefined,
  options: UploadValidationOptions,
) {
  if (!file?.buffer?.length) {
    throw new BadRequestException(`${options.fieldLabel} file is required`);
  }

  const extension = extname(file.originalname).toLowerCase();
  const allowedExtensions = new Set(
    options.allowedExtensions.map((entry) => entry.toLowerCase()),
  );
  const allowedMimeTypes = new Set(
    options.allowedMimeTypes.map((entry) => entry.toLowerCase()),
  );

  if (!allowedExtensions.has(extension)) {
    throw new BadRequestException(
      `Unsupported ${options.fieldLabel} file extension`,
    );
  }

  if (!allowedMimeTypes.has(file.mimetype.toLowerCase())) {
    throw new BadRequestException(
      `Unsupported ${options.fieldLabel} file type`,
    );
  }

  if (file.size > options.maxFileSizeBytes) {
    throw new BadRequestException(`${options.fieldLabel} file is too large`);
  }
}

export function sanitizeStorageFilename(filename: string) {
  return filename.replace(/[^A-Za-z0-9._-]/g, '-');
}
