import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { Prisma } from '../../../generated/prisma/client';
import { AttributeValueType } from '../../../generated/prisma/enums';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';

type AssignmentValueData = {
  valueText: string | null;
  valueNumber: number | null;
  valueBoolean: boolean | null;
  valueJson?:
    | Prisma.InputJsonValue
    | Prisma.NullableJsonNullValueInput;
};

@Injectable()
export class ProductAttributesService {
  constructor(private readonly prisma: PrismaService) {}

  listDefinitions(q?: string) {
    return this.prisma.attributeDefinition.findMany({
      where: q
        ? {
            OR: [
              { code: { contains: q } },
              { name: { contains: q } },
              { description: { contains: q } },
            ],
          }
        : undefined,
      include: {
        options: {
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createDefinition(input: {
    code: string;
    name: string;
    description?: string;
    valueType: AttributeValueType;
  }) {
    try {
      return await this.prisma.attributeDefinition.create({
        data: {
          id: randomUUID(),
          code: this.normalizeCode(input.code),
          name: input.name.trim(),
          description: input.description?.trim() || null,
          valueType: input.valueType,
        },
        include: { options: true },
      });
    } catch (error) {
      this.handleUniqueConflict(error, 'Attribute definition already exists');
    }
  }

  async updateDefinition(
    id: string,
    input: {
      name?: string;
      description?: string | null;
      valueType?: AttributeValueType;
    },
  ) {
    await this.ensureDefinition(id);

    return this.prisma.attributeDefinition.update({
      where: { id },
      data: {
        name: input.name?.trim(),
        description:
          input.description === undefined ? undefined : input.description?.trim() || null,
        valueType: input.valueType,
      },
      include: {
        options: {
          orderBy: { position: 'asc' },
        },
      },
    });
  }

  async createOption(
    definitionId: string,
    input: { value: string; label: string; position?: number },
  ) {
    const definition = await this.ensureDefinition(definitionId);

    if (definition.valueType !== AttributeValueType.SELECT) {
      throw new BadRequestException(
        'Only SELECT attribute definitions can have options',
      );
    }

    try {
      return await this.prisma.attributeDefinitionOption.create({
        data: {
          id: randomUUID(),
          definitionId,
          value: input.value.trim(),
          label: input.label.trim(),
          position: input.position ?? 0,
        },
      });
    } catch (error) {
      this.handleUniqueConflict(error, 'Attribute option already exists');
    }
  }

  async updateOption(
    id: string,
    input: { value?: string; label?: string; position?: number },
  ) {
    const option = await this.prisma.attributeDefinitionOption.findUnique({
      where: { id },
    });

    if (!option) {
      throw new NotFoundException('Attribute option not found');
    }

    try {
      return await this.prisma.attributeDefinitionOption.update({
        where: { id },
        data: {
          value: input.value?.trim(),
          label: input.label?.trim(),
          position: input.position,
        },
      });
    } catch (error) {
      this.handleUniqueConflict(error, 'Attribute option already exists');
    }
  }

  async removeOption(id: string) {
    const option = await this.prisma.attributeDefinitionOption.findUnique({
      where: { id },
    });

    if (!option) {
      throw new NotFoundException('Attribute option not found');
    }

    return this.prisma.attributeDefinitionOption.delete({
      where: { id },
    });
  }

  async listAssignments(productId: string, variantId?: string) {
    await this.ensureProduct(productId);

    return this.prisma.productAttributeAssignment.findMany({
      where: {
        productId,
        variantId: variantId ?? undefined,
      },
      include: {
        definition: {
          include: {
            options: {
              orderBy: { position: 'asc' },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async upsertAssignment(input: {
    productId: string;
    definitionId: string;
    variantId?: string | null;
    valueText?: string;
    valueNumber?: number;
    valueBoolean?: boolean;
    valueJson?: Record<string, unknown> | unknown[];
  }) {
    await this.ensureProduct(input.productId, input.variantId ?? undefined);
    const definition = await this.ensureDefinition(input.definitionId);

    const assignmentValue = this.buildAssignmentValue(definition.valueType, input);
    const existing = await this.prisma.productAttributeAssignment.findFirst({
      where: {
        productId: input.productId,
        definitionId: input.definitionId,
        variantId: input.variantId ?? null,
      },
    });

    if (existing) {
      return this.prisma.productAttributeAssignment.update({
        where: { id: existing.id },
        data: assignmentValue,
        include: {
          definition: true,
        },
      });
    }

    return this.prisma.productAttributeAssignment.create({
      data: {
        id: randomUUID(),
        productId: input.productId,
        definitionId: input.definitionId,
        variantId: input.variantId ?? null,
        ...assignmentValue,
      },
      include: {
        definition: true,
      },
    });
  }

  async removeAssignment(id: string) {
    const assignment = await this.prisma.productAttributeAssignment.findUnique({
      where: { id },
    });

    if (!assignment) {
      throw new NotFoundException('Product attribute assignment not found');
    }

    return this.prisma.productAttributeAssignment.delete({
      where: { id },
    });
  }

  private async ensureDefinition(id: string) {
    const definition = await this.prisma.attributeDefinition.findUnique({
      where: { id },
    });

    if (!definition) {
      throw new NotFoundException('Attribute definition not found');
    }

    return definition;
  }

  private async ensureProduct(productId: string, variantId?: string) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        variants: variantId
          ? {
              where: { id: variantId },
              take: 1,
            }
          : false,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (variantId && product.variants.length === 0) {
      throw new NotFoundException('Product variant not found');
    }

    return product;
  }

  private buildAssignmentValue(
    valueType: AttributeValueType,
    input: {
      valueText?: string;
      valueNumber?: number;
      valueBoolean?: boolean;
      valueJson?: Record<string, unknown> | unknown[];
    },
  ): AssignmentValueData {
    switch (valueType) {
      case AttributeValueType.NUMBER:
        if (input.valueNumber === undefined) {
          throw new BadRequestException('Numeric attribute value is required');
        }
        return {
          valueText: null,
          valueNumber: input.valueNumber,
          valueBoolean: null,
          valueJson: Prisma.JsonNull,
        };
      case AttributeValueType.BOOLEAN:
        if (input.valueBoolean === undefined) {
          throw new BadRequestException('Boolean attribute value is required');
        }
        return {
          valueText: null,
          valueNumber: null,
          valueBoolean: input.valueBoolean,
          valueJson: Prisma.JsonNull,
        };
      case AttributeValueType.JSON:
        if (input.valueJson === undefined) {
          throw new BadRequestException('JSON attribute value is required');
        }
        return {
          valueText: null,
          valueNumber: null,
          valueBoolean: null,
          valueJson: input.valueJson as Prisma.InputJsonValue,
        };
      case AttributeValueType.DATE:
      case AttributeValueType.SELECT:
      case AttributeValueType.TEXT:
      default:
        if (!input.valueText?.trim()) {
          throw new BadRequestException('Text attribute value is required');
        }
        return {
          valueText: input.valueText.trim(),
          valueNumber: null,
          valueBoolean: null,
          valueJson: Prisma.JsonNull,
        };
    }
  }

  private normalizeCode(code: string) {
    const normalized = code.trim().toUpperCase().replace(/\s+/g, '_');

    if (!normalized) {
      throw new BadRequestException('Code is required');
    }

    return normalized;
  }

  private handleUniqueConflict(error: unknown, message: string): never {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(message);
    }

    throw error;
  }
}
