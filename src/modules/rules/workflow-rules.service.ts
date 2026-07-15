import { Injectable } from '@nestjs/common';

import { Prisma } from '../../../generated/prisma/client';

type JsonRecord = Record<string, unknown>;

@Injectable()
export class WorkflowRulesService {
  evaluateCondition(
    conditionJson: Prisma.JsonValue,
    inputJson: Prisma.InputJsonValue,
  ): boolean {
    if (
      !this.isRecord(conditionJson) ||
      Object.keys(conditionJson).length === 0
    ) {
      return true;
    }

    return this.evaluateNode(conditionJson, inputJson);
  }

  private evaluateNode(
    node: unknown,
    inputJson: Prisma.InputJsonValue,
  ): boolean {
    if (!this.isRecord(node)) {
      return false;
    }

    const all = node.all ?? node.and;
    if (Array.isArray(all)) {
      return all.every((item) => this.evaluateNode(item, inputJson));
    }

    const any = node.any ?? node.or;
    if (Array.isArray(any)) {
      return any.some((item) => this.evaluateNode(item, inputJson));
    }

    if (typeof node.field !== 'string') {
      return false;
    }

    const left = this.getPathValue(inputJson, node.field);
    const operator = typeof node.operator === 'string' ? node.operator : 'eq';
    const right = node.value;

    return this.compare(left, operator, right);
  }

  private compare(left: unknown, operator: string, right: unknown): boolean {
    switch (operator) {
      case 'eq':
        return left === right;
      case 'neq':
        return left !== right;
      case 'gt':
        return this.toNumber(left) > this.toNumber(right);
      case 'gte':
        return this.toNumber(left) >= this.toNumber(right);
      case 'lt':
        return this.toNumber(left) < this.toNumber(right);
      case 'lte':
        return this.toNumber(left) <= this.toNumber(right);
      case 'contains':
        return typeof left === 'string' && typeof right === 'string'
          ? left.includes(right)
          : Array.isArray(left) && left.includes(right);
      case 'in':
        return Array.isArray(right) && right.includes(left);
      case 'exists':
        return right === false ? left === undefined : left !== undefined;
      default:
        return false;
    }
  }

  private getPathValue(inputJson: Prisma.InputJsonValue, path: string) {
    return path.split('.').reduce<unknown>((value, key) => {
      if (!this.isRecord(value)) {
        return undefined;
      }

      return value[key];
    }, inputJson);
  }

  private toNumber(value: unknown) {
    const numberValue = Number(value);

    return Number.isFinite(numberValue) ? numberValue : Number.NaN;
  }

  private isRecord(value: unknown): value is JsonRecord {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
