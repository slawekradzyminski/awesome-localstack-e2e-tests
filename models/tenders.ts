import type { PageDto } from './page';

export type GiftCardStatus = 'ACTIVE' | 'REDEEMED' | 'EXPIRED' | 'DISABLED';

export interface GiftCardCreateDto {
  amount: number;
  expiresAt?: string | null;
  recipientUsername?: string | null;
  note?: string | null;
}

export interface GiftCardTransactionDto {
  type: string;
  amount: number;
  balanceAfter: number;
  orderId: number | null;
  actor: string | null;
  createdAt: string;
}

export interface GiftCardDto {
  code: string;
  initialAmount: number;
  balance: number;
  status: GiftCardStatus;
  expiresAt: string | null;
  recipientUsername: string | null;
  note: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  transactions: GiftCardTransactionDto[];
}

export interface GiftCardBalanceDto {
  code: string;
  balance: number;
  status: GiftCardStatus;
  expiresAt: string | null;
}

export interface LoyaltyAccountDto {
  balance: number;
  lifetimeEarned: number;
  tier: string;
  valueOfBalance: number;
}

export interface LoyaltyTransactionDto {
  id: number;
  type: string;
  points: number;
  balanceAfter: number;
  orderId: number | null;
  createdAt: string;
}

export type GiftCardPageDto = PageDto<GiftCardDto>;
export type LoyaltyTransactionPageDto = PageDto<LoyaltyTransactionDto>;
