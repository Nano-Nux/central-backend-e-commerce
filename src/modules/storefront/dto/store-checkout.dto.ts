import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PaymentMethod } from '../../../../generated/prisma/enums';
import { CreateOrderItemDto } from '../../shared/dto/create-order.dto';

export class StoreCheckoutAddressDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  label?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(255)
  @IsOptional()
  recipientName?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(50)
  @IsOptional()
  phone?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  addressLine1!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(500)
  @IsOptional()
  addressLine2?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  city!: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(100)
  @IsOptional()
  stateOrProvince?: string;

  @ApiProperty()
  @IsString()
  @MaxLength(20)
  postalCode!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  country!: string;
}

export class EnhancedStoreCheckoutDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  guestName?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  guestEmail?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  guestPhone?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(255)
  @IsOptional()
  contactName?: string;

  @ApiPropertyOptional()
  @IsEmail()
  @IsOptional()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(50)
  @IsOptional()
  contactPhone?: string;

  @ApiPropertyOptional({ type: () => StoreCheckoutAddressDto })
  @ValidateNested()
  @Type(() => StoreCheckoutAddressDto)
  @IsOptional()
  shippingAddress?: StoreCheckoutAddressDto;

  @ApiPropertyOptional({ type: () => StoreCheckoutAddressDto })
  @ValidateNested()
  @Type(() => StoreCheckoutAddressDto)
  @IsOptional()
  billingAddress?: StoreCheckoutAddressDto;

  @ApiProperty()
  @IsString()
  @MaxLength(2000)
  orderNotes!: string;

  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({ type: () => Number })
  @Type(() => Number)
  @Min(0.01)
  @IsOptional()
  paymentAmount?: number;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  paymentReference?: string;

  @ApiPropertyOptional({ type: () => Number })
  @Type(() => Number)
  @Min(0)
  @IsOptional()
  discount?: number = 0;

  @ApiPropertyOptional({ type: () => Number })
  @Type(() => Number)
  @Min(0)
  @IsOptional()
  tax?: number = 0;

  @ApiProperty({ type: () => [CreateOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];
}

export class StoreCheckoutResponsePaymentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  method!: string;

  @ApiProperty()
  amount!: string;

  @ApiPropertyOptional()
  reference?: string | null;
}

export class StoreCheckoutResponseOrderDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  total!: string;

  @ApiProperty()
  currency!: string;
}

export class StoreCheckoutManualPaymentDetailsDto {
  @ApiProperty()
  providerName!: string;

  @ApiProperty()
  countryCode!: string;

  @ApiProperty()
  accountName!: string;

  @ApiProperty()
  accountNumber!: string;

  @ApiProperty()
  qrImageUrl!: string;

  @ApiProperty()
  paymentInstructions!: string;

  @ApiProperty()
  uploadProofUrl!: string;
}

export class StoreCheckoutResponsePayloadDto {
  @ApiProperty({ type: () => StoreCheckoutResponseOrderDto })
  order!: StoreCheckoutResponseOrderDto;

  @ApiProperty({ type: () => StoreCheckoutResponsePaymentDto })
  payment!: StoreCheckoutResponsePaymentDto;

  @ApiPropertyOptional({ type: () => StoreCheckoutManualPaymentDetailsDto })
  manualPayment?: StoreCheckoutManualPaymentDetailsDto;

  @ApiPropertyOptional()
  accessToken?: string | null;

  @ApiPropertyOptional({ deprecated: true })
  guestAccessToken?: string | null;
}

export class StoreCheckoutResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => StoreCheckoutResponsePayloadDto })
  data!: StoreCheckoutResponsePayloadDto;
}
