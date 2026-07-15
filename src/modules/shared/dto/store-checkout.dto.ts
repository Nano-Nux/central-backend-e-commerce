import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsEmail,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PaymentMethod } from '../../../../generated/prisma/enums';
import { CreateOrderItemDto } from './create-order.dto';

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

export class StoreCheckoutDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  idempotencyKey?: string;

  @ApiProperty({ type: () => [CreateOrderItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

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

  @ApiPropertyOptional({ description: 'Voucher code to apply to this checkout' })
  @IsString()
  @IsOptional()
  voucherCode?: string;
}
