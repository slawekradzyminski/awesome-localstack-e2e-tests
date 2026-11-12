export type OrderStatus = 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface AddressDto {
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
}

export interface OrderItemDto {
  id: number;
  productId: number;
  quantity: number;
  productName: string;
  unitPrice: number;
  totalPrice: number;
}

export interface OrderDto {
  id: number;
  username: string;
  items: OrderItemDto[];
  totalAmount: number;
  subtotalAmount?: number;
  discountAmount?: number;
  couponCode?: string | null;
  status: OrderStatus;
  fulfilmentState?: string | null;
  refundedAmount?: number | null;
  // VAT is included in prices: totalAmount = netAmount + taxAmount.
  taxCountry?: string | null;
  taxRate?: number | null;
  taxAmount?: number | null;
  netAmount?: number | null;
  // Tenders: amountDue = totalAmount - giftCardAmount - pointsAmount.
  giftCardCode?: string | null;
  giftCardAmount?: number | null;
  pointsRedeemed?: number | null;
  pointsAmount?: number | null;
  amountDue?: number | null;
  shippingAddress: AddressDto;
  createdAt: string;
  updatedAt: string;
}

