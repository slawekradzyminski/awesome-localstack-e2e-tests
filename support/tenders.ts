import { expect } from '@support/expect';
import { ASYNC_TIMEOUT, POLL_INTERVALS } from '@config';
import type { CartDto } from '@models/cart';
import type { OrderDto } from '@models/order';
import type {
  GiftCardDto,
  GiftCardStatus,
  LoyaltyAccountDto,
  LoyaltyTransactionPageDto,
} from '@models/tenders';
import type { Shopper } from './shopper';
import type { Admin } from './staff';

// Loyalty arithmetic of the backend (LoyaltyPoints): 1 point per full 1.00 of a paid order,
// redeemed in whole multiples of 100 where 100 points = 1.00; SILVER from 1000 lifetime points, GOLD from 5000.

// Present on the cart and the order only while a gift card or points are applied.
export const TENDER_FIELDS = ['giftCardCode', 'giftCardAmount', 'pointsRedeemed', 'pointsAmount', 'amountDue'] as const;

// The backend compares expiresAt with its local clock, which runs in UTC in the stack.
export function serverLocalDateTime(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString().replace('Z', '');
}

export async function giftCardDetails(admin: Admin, code: string): Promise<GiftCardDto> {
  const response = await admin.giftCards.getDetails(code);
  await expect(response, `Read gift card ${code}`).toHaveStatus(200);
  return response.json();
}

export async function disableGiftCard(admin: Admin, code: string): Promise<GiftCardDto> {
  const response = await admin.giftCards.disable(code);
  await expect(response, `Disable gift card ${code}`).toHaveStatus(200);
  return response.json();
}

export async function waitForGiftCardStatus(admin: Admin, code: string, status: GiftCardStatus): Promise<GiftCardDto> {
  await expect
    .poll(async () => (await giftCardDetails(admin, code)).status,
      { message: `gift card ${code} becomes ${status}`, timeout: ASYNC_TIMEOUT, intervals: POLL_INTERVALS })
    .toBe(status);
  return giftCardDetails(admin, code);
}

// expiresAt must be in the future when the card is issued, so the card is issued shortly before
// its expiry and the test waits (through the admin view, which has no rate limit) until it lapses.
export async function issueExpiredGiftCard(admin: Admin, amount = 20): Promise<GiftCardDto> {
  const card = await admin.issueGiftCard({ amount, expiresAt: serverLocalDateTime(2_000) });
  return waitForGiftCardStatus(admin, card.code, 'EXPIRED');
}

// Spends the whole card on a test-owned order of exactly its balance.
export async function issueRedeemedGiftCard(admin: Admin, shopper: Shopper, amount = 5): Promise<GiftCardDto> {
  const card = await admin.issueGiftCard({ amount });
  await shopper.fillCart({ price: amount });
  await applyGiftCard(shopper, card.code);
  await shopper.checkout();
  return giftCardDetails(admin, card.code);
}

export async function readCart(shopper: Shopper): Promise<CartDto> {
  const response = await shopper.cart.getCart();
  await expect(response, 'Read the cart').toHaveStatus(200);
  return response.json();
}

export async function applyGiftCard(shopper: Shopper, code: string): Promise<CartDto> {
  const response = await shopper.tenders.applyGiftCard(code);
  await expect(response, `Apply gift card ${code}`).toHaveStatus(200);
  return response.json();
}

export async function applyPoints(shopper: Shopper, points: number): Promise<CartDto> {
  const response = await shopper.tenders.applyPoints(points);
  await expect(response, `Apply ${points} loyalty points`).toHaveStatus(200);
  return response.json();
}

export async function loyaltyTransactions(shopper: Shopper, params: { page?: number; size?: number } = {}): Promise<LoyaltyTransactionPageDto> {
  const response = await shopper.loyalty.transactions(params);
  await expect(response, 'Read loyalty transactions').toHaveStatus(200);
  return response.json();
}

export async function waitForLoyaltyBalance(shopper: Shopper, balance: number): Promise<LoyaltyAccountDto> {
  await expect
    .poll(async () => (await shopper.loyaltyAccount()).balance,
      { message: `loyalty balance of ${shopper.username} becomes ${balance}`, timeout: ASYNC_TIMEOUT, intervals: POLL_INTERVALS })
    .toBe(balance);
  return shopper.loyaltyAccount();
}

// Points are only earned by paying an order: one card-paid order of `points` (whole units) earns exactly that many.
export async function earnPoints(shopper: Shopper, points: number): Promise<OrderDto> {
  const before = (await shopper.loyaltyAccount()).balance;
  const { order } = await shopper.placeOrder(points);
  await shopper.payAndWaitForPaid(order.id);
  await waitForLoyaltyBalance(shopper, before + points);
  return order;
}
