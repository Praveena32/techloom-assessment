export enum OrderStatus {
  PENDING = 'PENDING',
  RESERVED = 'RESERVED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  FAILED = 'FAILED',
}

export enum PaymentOutcome {
  SUCCESS = 'SUCCESS',
  FAILURE = 'FAILURE',
  TIMEOUT = 'TIMEOUT',
}

export interface CartItemInput {
  productId: string;
  quantity: number;
}

export interface CheckoutRequest {
  customerName?: string;
  items: CartItemInput[];
  idempotencyKey?: string;
}

export interface PaymentRequest {
  orderId: string;
  simulateStatus?: 'SUCCESS' | 'FAILURE' | 'TIMEOUT';
  idempotencyKey?: string;
}
