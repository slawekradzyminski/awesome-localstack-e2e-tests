import { ApiClient, segment } from './api-client';
import type { GiftCardCreateDto, GiftCardStatus } from '@models/tenders';

export class GiftCardsClient extends ApiClient {
  // ROLE_ADMIN
  issue(giftCard: GiftCardCreateDto) {
    return this.post('/api/v1/admin/gift-cards', giftCard);
  }

  list(params: { status?: GiftCardStatus; page?: number; size?: number } = {}) {
    return this.get('/api/v1/admin/gift-cards', params);
  }

  getDetails(code: string) {
    return this.get(`/api/v1/admin/gift-cards/${segment(code)}`);
  }

  disable(code: string) {
    return this.post(`/api/v1/admin/gift-cards/${segment(code)}/disable`);
  }

  // Any signed-in user
  balance(code: string) {
    return this.get(`/api/v1/gift-cards/${segment(code)}`);
  }
}

export class LoyaltyClient extends ApiClient {
  account() {
    return this.get('/api/v1/loyalty');
  }

  transactions(params: { page?: number; size?: number } = {}) {
    return this.get('/api/v1/loyalty/transactions', params);
  }
}

// Gift cards and loyalty points are applied to the cart and copied onto the order at checkout.
export class CartTendersClient extends ApiClient {
  applyGiftCard(code: string) {
    return this.put('/api/v1/cart/gift-card', { code });
  }

  removeGiftCard() {
    return this.delete('/api/v1/cart/gift-card');
  }

  applyPoints(points: number) {
    return this.put('/api/v1/cart/loyalty-points', { points });
  }

  removePoints() {
    return this.delete('/api/v1/cart/loyalty-points');
  }

  // VAT contained in the cart total for a shipping country (code or name); omit the country to test validation.
  taxPreview(country?: string) {
    return this.get('/api/v1/cart/tax-preview', { country });
  }
}
