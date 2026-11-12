import type { PageDto } from './page';

export type PaymentStatus =
  | 'REQUIRES_ACTION' | 'PROCESSING' | 'CAPTURED' | 'FAILED' | 'PARTIALLY_REFUNDED' | 'REFUNDED' | 'VOIDED';

export type PaymentFailureCode =
  | 'CARD_DECLINED' | 'INSUFFICIENT_FUNDS' | 'THREE_DS_FAILED' | 'THREE_DS_EXPIRED' | 'PROVIDER_TIMEOUT' | 'ORDER_NOT_PAYABLE';

export type CardBrand = 'VISA' | 'MASTERCARD' | 'AMEX' | 'OTHER';

export interface CardDto {
  number: string;
  expiryMonth: number;
  expiryYear: number;
  cvc: string;
  holderName: string;
}

export interface CreatePaymentDto {
  orderId: number;
  card: CardDto;
}

export interface PaymentDto {
  id: string;
  orderId: number;
  status: PaymentStatus;
  amount: number;
  currency: string;
  cardBrand: CardBrand;
  cardLast4: string;
  failureCode: PaymentFailureCode | null;
  failureMessage: string | null;
  nextAction: { type: 'THREE_DS_CHALLENGE'; hint: string } | null;
  refundedAmount: number;
  createdAt: string;
  updatedAt: string;
}

export type PaymentPageDto = PageDto<PaymentDto>;
