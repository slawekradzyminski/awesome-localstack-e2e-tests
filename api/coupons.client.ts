import { ApiClient, segment } from './api-client';
import type { CouponRequestDto } from '@models/coupon';

export const ADMIN_COUPONS_ENDPOINT = '/api/v1/admin/coupons';
export const CART_COUPON_ENDPOINT = '/api/v1/cart/coupon';

/** Admin coupon management; needs an admin token. */
export class AdminCouponsClient extends ApiClient {
  create(coupon: CouponRequestDto) {
    return this.post(ADMIN_COUPONS_ENDPOINT, coupon);
  }

  list(page = 0, size = 50) {
    return this.get(ADMIN_COUPONS_ENDPOINT, { page, size });
  }

  remove(couponId: number) {
    return this.delete(`${ADMIN_COUPONS_ENDPOINT}/${segment(couponId)}`);
  }
}

/** The signed-in customer's coupon on their cart. */
export class CartCouponClient extends ApiClient {
  apply(code: string) {
    return this.put(CART_COUPON_ENDPOINT, { code });
  }

  remove() {
    return this.delete(CART_COUPON_ENDPOINT);
  }
}
