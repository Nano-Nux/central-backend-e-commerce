import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { MerchantPaymentProviderName } from '../../../../generated/prisma/enums';

export class UploadPaymentProofDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  paymentId?: string;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  file?: unknown;
}

export class RejectPaymentProofDto {
  @ApiProperty()
  @IsString()
  @MaxLength(500)
  reason!: string;
}

export class CreateLinePaySessionDto {
  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  paymentId?: string;

  @ApiProperty()
  @IsUrl()
  returnUrl!: string;

  @ApiPropertyOptional()
  @IsUrl()
  @IsOptional()
  cancelUrl?: string;
}

export class ConfirmLinePaySessionDto {
  @ApiProperty()
  @IsString()
  providerSessionId!: string;
}

export class LinePayCallbackDto {
  @ApiProperty()
  @IsString()
  providerSessionId!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  transactionId?: string;
}

export class PaymentProofDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  paymentId!: string;

  @ApiProperty()
  orderId!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  objectName!: string;

  @ApiProperty()
  originalFilename!: string;

  @ApiProperty()
  contentType!: string;

  @ApiProperty()
  size!: number;

  @ApiPropertyOptional()
  rejectionReason?: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class PaymentProofResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => PaymentProofDto })
  data!: PaymentProofDto;
}

export class PaymentProofListResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => [PaymentProofDto] })
  data!: PaymentProofDto[];
}

export class LinePaySessionDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  providerSessionId!: string;

  @ApiProperty()
  provider!: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  paymentUrl?: string | null;
}

export class LinePaySessionResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => LinePaySessionDto })
  data!: LinePaySessionDto;
}

export class StorePaymentMethodDto {
  @ApiProperty()
  code!: string;

  @ApiProperty()
  displayName!: string;

  @ApiPropertyOptional()
  description?: string | null;
}

export class StorePaymentMethodListResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => [StorePaymentMethodDto] })
  data!: StorePaymentMethodDto[];
}

export class MerchantPaymentConfigurationDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: MerchantPaymentProviderName })
  providerName!: MerchantPaymentProviderName;

  @ApiProperty()
  countryCode!: string;

  @ApiProperty()
  accountName!: string;

  @ApiProperty()
  accountNumber!: string;

  @ApiProperty()
  qrImageFileId!: string;

  @ApiProperty()
  qrImageUrl!: string;

  @ApiProperty()
  isActive!: boolean;
}

export class MerchantPaymentConfigurationResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => MerchantPaymentConfigurationDto })
  data!: MerchantPaymentConfigurationDto;
}

export class MerchantPaymentConfigurationListResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => [MerchantPaymentConfigurationDto] })
  data!: MerchantPaymentConfigurationDto[];
}

export class UpsertMerchantPaymentConfigurationDto {
  @ApiProperty({ enum: MerchantPaymentProviderName })
  @IsEnum(MerchantPaymentProviderName)
  providerName!: MerchantPaymentProviderName;

  @ApiProperty()
  @IsString()
  @MaxLength(10)
  countryCode!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  accountName!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  accountNumber!: string;

  @ApiPropertyOptional({ type: () => Boolean })
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({ type: 'string', format: 'binary' })
  file?: unknown;
}
