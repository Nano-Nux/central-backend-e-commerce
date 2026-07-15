import { Prisma } from '../../../generated/prisma/client';

export type MoneyInput = string | number | Prisma.Decimal;

export function toMoney(value: MoneyInput) {
  return new Prisma.Decimal(value);
}

export function addMoney(left: MoneyInput, right: MoneyInput) {
  return toMoney(left).plus(toMoney(right));
}

export function subtractMoney(left: MoneyInput, right: MoneyInput) {
  return toMoney(left).minus(toMoney(right));
}

export function multiplyMoney(value: MoneyInput, multiplier: MoneyInput) {
  return toMoney(value).mul(toMoney(multiplier));
}

export function isNegativeMoney(value: MoneyInput) {
  return toMoney(value).lt(0);
}

export function formatMoney(value: MoneyInput) {
  return toMoney(value).toFixed(2);
}
