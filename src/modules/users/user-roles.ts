export const UserRoleNames = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'Staff',
  CASHIER: 'Cashier',
  SUPPORT_AGENT: 'Support Agent',
  SALES_AGENT: 'Sales Agent',
  WAREHOUSE_STAFF: 'Warehouse Staff',
  ACCOUNTANT: 'Accountant',
  MARKETING_STAFF: 'Marketing Staff',
  CUSTOMER: 'Customer',
} as const;

export const DEFAULT_ROLE_NAMES = Object.values(UserRoleNames);
