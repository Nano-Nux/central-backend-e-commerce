import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import { StorePaginationDto } from './store-catalog.dto';

export class StoreMeDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiPropertyOptional()
  phone?: string | null;

  @ApiProperty()
  email!: string;

  @ApiProperty()
  createdAt!: Date;
}

export class UpdateStoreMeDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @MaxLength(50)
  @IsOptional()
  phone?: string;
}

export class StoreCustomerAddressDto {
  @ApiProperty()
  id!: string;

  @ApiPropertyOptional()
  label?: string | null;

  @ApiPropertyOptional()
  recipientName?: string | null;

  @ApiPropertyOptional()
  phone?: string | null;

  @ApiProperty()
  addressLine1!: string;

  @ApiPropertyOptional()
  addressLine2?: string | null;

  @ApiProperty()
  city!: string;

  @ApiPropertyOptional()
  stateOrProvince?: string | null;

  @ApiProperty()
  postalCode!: string;

  @ApiProperty()
  country!: string;

  @ApiProperty()
  isDefaultShipping!: boolean;

  @ApiProperty()
  isDefaultBilling!: boolean;
}

export class CreateStoreCustomerAddressDto {
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

  @ApiPropertyOptional()
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isDefaultShipping?: boolean = false;

  @ApiPropertyOptional()
  @Type(() => Boolean)
  @IsBoolean()
  @IsOptional()
  isDefaultBilling?: boolean = false;
}

export class UpdateStoreCustomerAddressDto extends CreateStoreCustomerAddressDto {}

export class StoreOrderSummaryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  status!: string;

  @ApiProperty()
  type!: string;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  currency!: string;

  @ApiProperty()
  total!: string;
}

export class StoreOrderItemDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  productId!: string;

  @ApiProperty()
  productName!: string;

  @ApiPropertyOptional()
  variantId?: string | null;

  @ApiPropertyOptional()
  variantName?: string | null;

  @ApiProperty()
  quantity!: string;

  @ApiProperty()
  unitPrice!: string;

  @ApiProperty()
  totalPrice!: string;
}

export class StoreOrderPaymentDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  method!: string;

  @ApiProperty()
  amount!: string;

  @ApiProperty()
  status!: string;

  @ApiPropertyOptional()
  reference?: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class StoreOrderDetailDto extends StoreOrderSummaryDto {
  @ApiProperty()
  subtotal!: string;

  @ApiProperty()
  discount!: string;

  @ApiProperty()
  tax!: string;

  @ApiProperty({ type: () => [StoreOrderItemDto] })
  items!: StoreOrderItemDto[];

  @ApiProperty({ type: () => [StoreOrderPaymentDto] })
  payments!: StoreOrderPaymentDto[];
}

export class StoreOrderListQueryDto {
  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  status?: string;
}

export class StoreMeResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => StoreMeDto })
  data!: StoreMeDto;
}

export class StoreAddressListResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => [StoreCustomerAddressDto] })
  data!: StoreCustomerAddressDto[];
}

export class StoreAddressResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => StoreCustomerAddressDto })
  data!: StoreCustomerAddressDto;
}

export class StoreDeleteResponseDataDto {
  @ApiProperty()
  deleted!: boolean;
}

export class StoreDeleteResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => StoreDeleteResponseDataDto })
  data!: StoreDeleteResponseDataDto;
}

export class StoreOrderListResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => [StoreOrderSummaryDto] })
  data!: StoreOrderSummaryDto[];

  @ApiProperty({ type: () => StorePaginationDto })
  pagination!: StorePaginationDto;
}

export class StoreOrderDetailResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => StoreOrderDetailDto })
  data!: StoreOrderDetailDto;
}
