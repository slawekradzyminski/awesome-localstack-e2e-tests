import { expect } from '@support/expect';
import { THREE_DS_CODE } from '@api/payments.client';
import type { CardBrand, PaymentDto, PaymentFailureCode, PaymentStatus } from '@models/payment';
import type { Shopper } from './shopper';

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

// Every field payment-service returns; the card number and CVC are never among them.
export const PAYMENT_FIELDS = [
  'amount', 'cardBrand', 'cardLast4', 'createdAt', 'currency', 'failureCode', 'failureMessage', 'id', 'nextAction',
  'orderId', 'refundedAmount', 'status', 'updatedAt',
];

export const FAILURE_MESSAGES: Partial<Record<PaymentFailureCode, string>> = {
  CARD_DECLINED: 'Your card was declined',
  INSUFFICIENT_FUNDS: 'Your card has insufficient funds',
  THREE_DS_FAILED: '3-D Secure authentication failed',
  PROVIDER_TIMEOUT: 'The payment provider did not respond in time',
};

export const THREE_DS_CHALLENGE = {
  type: 'THREE_DS_CHALLENGE',
  hint: `Enter code ${THREE_DS_CODE} to approve; any other code fails`,
} as const;

export const NOT_PAYABLE = { message: 'Order is not payable' };

export function cardBrandOf(cardNumber: string): CardBrand {
  if (cardNumber.startsWith('4')) return 'VISA';
  if (cardNumber.startsWith('5')) return 'MASTERCARD';
  throw new Error(`No brand mapping for test card ${cardNumber}`);
}

// The PaymentDto payment-service answers for a test card on an order with the given amount due.
export function expectedPayment(
  orderId: number,
  amount: number,
  cardNumber: string,
  status: PaymentStatus,
  failureCode: PaymentFailureCode | null = null,
) {
  return {
    id: expect.stringMatching(UUID_PATTERN),
    orderId,
    status,
    amount,
    currency: 'USD',
    cardBrand: cardBrandOf(cardNumber),
    cardLast4: cardNumber.slice(-4),
    failureCode,
    failureMessage: failureCode ? FAILURE_MESSAGES[failureCode] : null,
    nextAction: status === 'REQUIRES_ACTION' ? THREE_DS_CHALLENGE : null,
    refundedAmount: 0,
    createdAt: expect.any(String),
    updatedAt: expect.any(String),
  };
}

// A month that has already ended: the card expired at the end of it.
export function lastMonth(now = new Date()): { expiryMonth: number; expiryYear: number } {
  const month = now.getMonth(); // 0-based, so this is the previous month 1-based
  return month === 0
    ? { expiryMonth: 12, expiryYear: now.getFullYear() - 1 }
    : { expiryMonth: month, expiryYear: now.getFullYear() };
}

export async function orderPayments(shopper: Shopper, orderId: number): Promise<PaymentDto[]> {
  const response = await shopper.payments.listForOrder(orderId);
  await expect(response, `Payments of order ${orderId}`).toHaveStatus(200);
  return response.json();
}

// payment-service timestamps have no zone and drop trailing zeros of the fraction ("…:06.73698");
// padding the fraction makes them compare correctly as strings.
export function sortableTimestamp(timestamp: string): string {
  const [seconds, fraction = ''] = timestamp.split('.');
  return `${seconds}.${fraction.padEnd(9, '0')}`;
}

// Nanoseconds since the epoch of a zone-less payment-service timestamp (UTC).
export function timestampNanos(timestamp: string): bigint {
  const [seconds, fraction = ''] = timestamp.split('.');
  return BigInt(Date.parse(`${seconds}Z`)) * 1_000_000n + BigInt(fraction.padEnd(9, '0'));
}

// The first answer carries nanoseconds and the stored copy rounded microseconds, so a re-read payment
// is the same one when everything but the timestamps matches and they agree to the microsecond.
export function expectSamePayment(actual: PaymentDto, original: PaymentDto): void {
  expect(actual).toEqual({ ...original, createdAt: expect.any(String), updatedAt: expect.any(String) });
  for (const field of ['createdAt', 'updatedAt'] as const) {
    const delta = timestampNanos(actual[field]) - timestampNanos(original[field]);
    expect(delta >= -1_000n && delta <= 1_000n, `${field} ${actual[field]} matches ${original[field]}`).toBe(true);
  }
}
