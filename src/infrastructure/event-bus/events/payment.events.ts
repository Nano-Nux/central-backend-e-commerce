import { PaymentMethod, PaymentStatus } from '../../../../generated/prisma/enums';

export type PaymentOrderItemPayload = {
  id: string;
  productId: string;
  stockItemId: string | null;
  variantId: string | null;
  unitId: string | null;
  assetIds: string[];
  isStockTracked: boolean;
  isSerialized: boolean;
  serialNumbers: string[];
  quantity: string;
  baseQuantity: string;
  unitPrice: string;
  totalPrice: string;
};

export type PaymentOrderPayload = {
  id: string;
  customerId: string | null;
  type: string;
  guestName: string | null;
  guestEmail: string | null;
  guestPhone: string | null;
  status: string;
  source: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  currency: string;
  items: PaymentOrderItemPayload[];
};

export type PaymentRecordedEventPayload = {
  payment: {
    id: string;
    orderId: string;
    method: PaymentMethod;
    amount: string;
    status: PaymentStatus;
    reference?: string | null;
  };
  order: PaymentOrderPayload;
  orderFullyPaid: boolean;
};

export type PaymentRefundedEventPayload = {
  originalPayment: PaymentRecordedEventPayload['payment'];
  refundPayment: PaymentRecordedEventPayload['payment'];
  order: PaymentOrderPayload;
};
