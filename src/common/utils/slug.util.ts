export function slugify(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildStableSlug(name: string, suffix?: string) {
  const base = slugify(name) || 'item';

  if (!suffix) {
    return base;
  }

  return `${base}-${suffix.toLowerCase()}`;
}
