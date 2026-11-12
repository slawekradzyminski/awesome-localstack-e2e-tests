import { randomUUID } from 'node:crypto';
import { ApiClient, segment } from './api-client';
import type { CardDto, CreatePaymentDto, PaymentStatus } from '@models/payment';

export const PAYMENTS_ENDPOINT = '/api/v1/payments';

// Simulated card outcomes of payment-service (docs/PAYMENT_SERVICE_CONTRACT.md in awesome-localstack).
export const TEST_CARDS = {
  visa: '4242424242424242',
  mastercard: '5555555555554444',
  declined: '4000000000000002',
  insufficientFunds: '4000000000009995',
  threeDs: '4000000000003220',
  asyncSuccess: '4000000000000077',
  asyncTimeout: '4000000000000119',
  duplicateNotification: '4000000000000259',
  luhnInvalid: '4242424242424241',
} as const;

export const THREE_DS_CODE = '123456';

export function card(number: string = TEST_CARDS.visa, overrides: Partial<CardDto> = {}): CardDto {
  return { number, expiryMonth: 12, expiryYear: new Date().getFullYear() + 5, cvc: '123', holderName: 'Test Customer', ...overrides };
}

export const newIdempotencyKey = () => `pw-${randomUUID()}`;

export class PaymentsClient extends ApiClient {
  create(payment: CreatePaymentDto, idempotencyKey: string | null = newIdempotencyKey(), headers: Record<string, string> = {}) {
    return this.post(PAYMENTS_ENDPOINT, payment, idempotencyKey === null ? headers : { 'Idempotency-Key': idempotencyKey, ...headers });
  }

  // Sends any body as is, for validation tests that need missing or malformed fields.
  createUnchecked(body: unknown, idempotencyKey: string | null = newIdempotencyKey()) {
    return this.post(PAYMENTS_ENDPOINT, body, idempotencyKey === null ? {} : { 'Idempotency-Key': idempotencyKey });
  }

  pay(orderId: number, cardNumber: string = TEST_CARDS.visa) {
    return this.create({ orderId, card: card(cardNumber) });
  }

  submit3ds(paymentId: string, code: string = THREE_DS_CODE) {
    return this.post(`${PAYMENTS_ENDPOINT}/${segment(paymentId)}/3ds`, { code });
  }

  submit3dsUnchecked(paymentId: string, body: unknown) {
    return this.post(`${PAYMENTS_ENDPOINT}/${segment(paymentId)}/3ds`, body);
  }

  getById(paymentId: string) {
    return this.get(`${PAYMENTS_ENDPOINT}/${segment(paymentId)}`);
  }

  listForOrder(orderId: number | string) {
    return this.get(`/api/v1/orders/${segment(orderId)}/payments`);
  }

  listAll(params: { status?: PaymentStatus; page?: number; size?: number } = {}) {
    return this.get('/api/v1/admin/payments', params);
  }
}
