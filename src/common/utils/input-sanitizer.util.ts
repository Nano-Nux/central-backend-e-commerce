import sanitizeHtml from 'sanitize-html';

export function sanitizePlainText(value: string) {
  return sanitizeHtml(value, {
    allowedTags: [],
    allowedAttributes: {},
  }).trim();
}

export function sanitizeOptionalPlainText(value?: string | null) {
  if (value === undefined || value === null) {
    return undefined;
  }

  const sanitized = sanitizePlainText(value);

  return sanitized ? sanitized : undefined;
}

export function normalizeEmail(value?: string | null) {
  const normalized = value?.trim().toLowerCase();

  return normalized ? normalized : undefined;
}

export function normalizeOptionalToken(value?: string | null) {
  const normalized = value?.trim();

  return normalized ? normalized : undefined;
}
