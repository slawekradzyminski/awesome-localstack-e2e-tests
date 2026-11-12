export interface CartItemDto {
  productId: number;
  quantity: number;
}

export interface UpdateCartItemDto {
  quantity: number;
}

export interface CartDto {
  username: string;
  items: CartItemDto[];
  totalPrice: number;
  totalItems: number;
  couponCode?: string | null;
  discountAmount?: number;
  totalAfterDiscount?: number;
  // Present only when a gift card or loyalty points are applied.
  giftCardCode?: string | null;
  giftCardAmount?: number | null;
  pointsRedeemed?: number | null;
  pointsAmount?: number | null;
  amountDue?: number | null;
}
