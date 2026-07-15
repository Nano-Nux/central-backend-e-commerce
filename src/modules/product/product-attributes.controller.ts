import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

import { AttributeValueType } from '../../../generated/prisma/enums';
import { ApiSuccessResponseDto } from '../../common/dto/api-success-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ProductAttributesService } from './product-attributes.service';

class CreateAttributeDefinitionDto {
  @ApiProperty()
  @IsString()
  @MaxLength(100)
  code!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ enum: AttributeValueType })
  @IsEnum(AttributeValueType)
  valueType!: AttributeValueType;
}

class UpdateAttributeDefinitionDto {
  @ApiPropertyOptional()
  @IsString()
  @MaxLength(255)
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  description?: string | null;

  @ApiPropertyOptional({ enum: AttributeValueType })
  @IsEnum(AttributeValueType)
  @IsOptional()
  valueType?: AttributeValueType;
}

class CreateAttributeOptionDto {
  @ApiProperty()
  @IsString()
  value!: string;

  @ApiProperty()
  @IsString()
  label!: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  position?: number;
}

class UpdateAttributeOptionDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  value?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  label?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  position?: number;
}

class UpsertProductAttributeAssignmentDto {
  @ApiProperty()
  @IsUUID()
  definitionId!: string;

  @ApiPropertyOptional()
  @IsUUID()
  @IsOptional()
  variantId?: string | null;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  valueText?: string;

  @ApiPropertyOptional()
  @Type(() => Number)
  @IsNumber()
  @IsOptional()
  valueNumber?: number;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  valueBoolean?: boolean;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  valueJson?: Record<string, unknown> | unknown[];
}

@ApiTags('Product Attributes')
@ApiBearerAuth()
@Controller('products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('Admin', 'Manager')
export class ProductAttributesController {
  constructor(
    private readonly productAttributesService: ProductAttributesService,
  ) {}

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get('attribute-definitions')
  async listDefinitions(@Query('q') q?: string) {
    return {
      success: true,
      message: 'Success',
      data: await this.productAttributesService.listDefinitions(q),
    };
  }

  @ApiCreatedResponse({ type: ApiSuccessResponseDto })
  @Post('attribute-definitions')
  async createDefinition(@Body() dto: CreateAttributeDefinitionDto) {
    return {
      success: true,
      message: 'Attribute definition created successfully',
      data: await this.productAttributesService.createDefinition(dto),
    };
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Patch('attribute-definitions/:id')
  async updateDefinition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttributeDefinitionDto,
  ) {
    return {
      success: true,
      message: 'Attribute definition updated successfully',
      data: await this.productAttributesService.updateDefinition(id, dto),
    };
  }

  @ApiCreatedResponse({ type: ApiSuccessResponseDto })
  @Post('attribute-definitions/:definitionId/options')
  async createOption(
    @Param('definitionId', ParseUUIDPipe) definitionId: string,
    @Body() dto: CreateAttributeOptionDto,
  ) {
    return {
      success: true,
      message: 'Attribute option created successfully',
      data: await this.productAttributesService.createOption(definitionId, dto),
    };
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Patch('attribute-options/:id')
  async updateOption(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAttributeOptionDto,
  ) {
    return {
      success: true,
      message: 'Attribute option updated successfully',
      data: await this.productAttributesService.updateOption(id, dto),
    };
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Delete('attribute-options/:id')
  async removeOption(@Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      message: 'Attribute option removed successfully',
      data: await this.productAttributesService.removeOption(id),
    };
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Get(':productId/attribute-assignments')
  async listAssignments(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Query('variantId') variantId?: string,
  ) {
    return {
      success: true,
      message: 'Success',
      data: await this.productAttributesService.listAssignments(
        productId,
        variantId,
      ),
    };
  }

  @ApiCreatedResponse({ type: ApiSuccessResponseDto })
  @Post(':productId/attribute-assignments')
  async upsertAssignment(
    @Param('productId', ParseUUIDPipe) productId: string,
    @Body() dto: UpsertProductAttributeAssignmentDto,
  ) {
    return {
      success: true,
      message: 'Product attribute assignment saved successfully',
      data: await this.productAttributesService.upsertAssignment({
        ...dto,
        productId,
      }),
    };
  }

  @ApiOkResponse({ type: ApiSuccessResponseDto })
  @Delete('attribute-assignments/:id')
  async removeAssignment(@Param('id', ParseUUIDPipe) id: string) {
    return {
      success: true,
      message: 'Product attribute assignment removed successfully',
      data: await this.productAttributesService.removeAssignment(id),
    };
  }
}
