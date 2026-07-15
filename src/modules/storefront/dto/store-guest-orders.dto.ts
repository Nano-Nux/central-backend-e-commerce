import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  ValidateIf,
} from 'class-validator';

import {
  StoreOrderDetailDto,
  StoreOrderSummaryDto,
} from './store-account.dto';

export class GuestOrderLookupRequestDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  orderId?: string;
}

export class GuestOrderVerifyDto {
  @ApiProperty()
  @IsEmail()
  email!: string;

  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  verificationToken!: string;
}

export class GuestOrderClaimDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  accessToken?: string;

  @ApiPropertyOptional({ deprecated: true })
  @ValidateIf((value: GuestOrderClaimDto) => value.accessToken === undefined)
  @IsString()
  @IsOptional()
  guestAccessToken?: string;
}

export class GuestOrderLookupRequestResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ example: 'Verification email sent if eligible orders exist.' })
  message!: string;
}

export class GuestOrderVerifyResponsePayloadDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  expiresAt!: Date;
}

export class GuestOrderVerifyResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => GuestOrderVerifyResponsePayloadDto })
  data!: GuestOrderVerifyResponsePayloadDto;
}

export class GuestOrderListResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => [StoreOrderSummaryDto] })
  data!: StoreOrderSummaryDto[];
}

export class GuestOrderDetailResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => StoreOrderDetailDto })
  data!: StoreOrderDetailDto;
}

export class GuestOrderClaimResponsePayloadDto {
  @ApiProperty()
  claimedCount!: number;
}

export class GuestOrderClaimResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty({ type: () => GuestOrderClaimResponsePayloadDto })
  data!: GuestOrderClaimResponsePayloadDto;
}
