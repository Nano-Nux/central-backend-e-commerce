export function nowUtc() {
  return new Date();
}

export function parseRequiredDate(value: string | Date, fieldName = 'date') {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(`${fieldName} must be a valid date`);
  }

  return date;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);

  return next;
}

export function isWithinRange(
  date: Date,
  start?: Date | null,
  end?: Date | null,
) {
  if (start && date < start) {
    return false;
  }

  if (end && date > end) {
    return false;
  }

  return true;
}
