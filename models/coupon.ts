export type CouponType = 'PERCENTAGE' | 'FIXED_AMOUNT';
export type CouponStatus = 'ACTIVE' | 'SCHEDULED' | 'EXPIRED' | 'EXHAUSTED' | 'INACTIVE';

/** POST/PUT /api/v1/admin/coupons. validFrom/validUntil are UTC wall time (a trailing Z is accepted). */
export interface CouponRequestDto {
  code: string;
  description?: string;
  type: CouponType;
  value: number;
  minOrderAmount?: number;
  validFrom?: string;
  validUntil?: string;
  maxRedemptions?: number;
  perUserLimit?: number;
  active?: boolean;
}

export interface CouponDto {
  id: number;
  code: string;
  description: string | null;
  type: CouponType;
  value: number;
  minOrderAmount: number | null;
  validFrom: string | null;
  validUntil: string | null;
  maxRedemptions: number | null;
  perUserLimit: number;
  redemptionCount: number;
  active: boolean;
  status: CouponStatus;
  createdAt: string;
  updatedAt: string;
}
