export enum OrderStatus {
  PENDING = 'PENDING',
  RESERVED = 'RESERVED',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  REFUNDED = 'REFUNDED',
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
  customerEmail?: string;
  shippingAddress?: string;
  items: CartItemInput[];
  idempotencyKey?: string;
}

export interface PaymentRequest {
  orderId: string;
  simulateStatus?: 'SUCCESS' | 'FAILURE' | 'TIMEOUT';
  idempotencyKey?: string;
}

export interface ProductQueryParams {
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  sort?: 'price_asc' | 'price_desc' | 'rating' | 'newest';
}
