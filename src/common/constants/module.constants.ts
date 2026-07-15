export const SystemModules = {
  AUTH: 'AUTH',
  USERS: 'USERS',
  AUDIT: 'AUDIT',
  PRODUCT: 'PRODUCT',
  CATEGORY: 'CATEGORY',
  INVENTORY: 'INVENTORY',
  ORDERS: 'ORDERS',
  PAYMENTS: 'PAYMENTS',
  POS: 'POS',
  ACCOUNTING: 'ACCOUNTING',
  PURCHASE: 'PURCHASE',
  CRM: 'CRM',
  COMMUNICATION: 'COMMUNICATION',
  WORKFLOW: 'WORKFLOW',
  AI_GATEWAY: 'AI_GATEWAY',
  FILE: 'FILE',
  SYSTEM: 'SYSTEM',
} as const;

export type SystemModuleName =
  (typeof SystemModules)[keyof typeof SystemModules];
