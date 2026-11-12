import { randomInt } from 'node:crypto';
import { test, type TestInfo } from '@playwright/test';
import { expect } from '@support/expect';
import type { TaxClient } from '@api/tax.client';
import type { ApiTestContext } from './api-test-context';
import type { Shopper } from './shopper';
import type { CurrencyDto, VatRateDto } from '@models/tax';

// Seeded rows other tests rely on. Tests read them, they never change them.
export const SEEDED_VAT = {
  PL: { countryCode: 'PL', countryName: 'Poland', rate: 23 },
  DE: { countryCode: 'DE', countryName: 'Germany', rate: 19 },
  FR: { countryCode: 'FR', countryName: 'France', rate: 20 },
  US: { countryCode: 'US', countryName: 'United States', rate: 0 },
} as const;

export const SEEDED_CURRENCIES = {
  USD: { code: 'USD', name: 'US Dollar', symbol: '$', rateToUsd: 1 },
  EUR: { code: 'EUR', name: 'Euro', symbol: '€', rateToUsd: 1.08 },
  PLN: { code: 'PLN', name: 'Polish Zloty', symbol: 'zł', rateToUsd: 0.25 },
  GBP: { code: 'GBP', name: 'British Pound', symbol: '£', rateToUsd: 1.27 },
  CHF: { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', rateToUsd: 1.13 },
} as const;

export const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/;

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
// Two-letter inputs that the backend's country resolver maps to another code (UK is stored as GB).
const ALIASED_ALPHA_2 = new Set(['UK']);

const randomCode = (length: number) => Array.from({ length }, () => LETTERS[randomInt(LETTERS.length)]).join('');

/*
 * VAT rates and currencies have no delete endpoint, so a test that creates a new code uses up a finite
 * space on a long-lived stack. Tests that only need "a country with 25 % VAT" therefore reuse a small,
 * fixed pool of test-owned codes: PUT is an idempotent upsert, and every test sets the values it needs
 * before it asserts anything.
 *
 * The code depends on the worker's parallelIndex (unique among workers running at the same time) and
 * a per-test slot, so parallel tests never share one and repeated runs never consume new ones.
 * Two-letter codes come from the ISO 3166 user-assigned ranges XA-XZ and QM-QY; currencies use PWA-PWZ.
 */
const VAT_CODE_POOL = [...[...LETTERS].map((letter) => `X${letter}`), ...[...'MNOPQRSTUVWXY'].map((letter) => `Q${letter}`)];
const CURRENCY_CODE_POOL = [...LETTERS].map((letter) => `PW${letter}`);
const SLOTS_PER_TEST = 2;
const slotsInUse = new WeakMap<TestInfo, Map<readonly string[], number>>();

function pooledCode(pool: readonly string[], kind: string): string {
  const testInfo = test.info();
  const used = slotsInUse.get(testInfo) ?? new Map<readonly string[], number>();
  slotsInUse.set(testInfo, used);
  const slot = used.get(pool) ?? 0;
  used.set(pool, slot + 1);
  const index = testInfo.parallelIndex * SLOTS_PER_TEST + slot;
  if (slot >= SLOTS_PER_TEST || index >= pool.length) {
    throw new Error(`No pooled ${kind} code for worker ${testInfo.parallelIndex}, slot ${slot}: `
      + `the pool of ${pool.length} supports ${Math.floor(pool.length / SLOTS_PER_TEST)} workers with ${SLOTS_PER_TEST} codes per test`);
  }
  return pool[index];
}

/**
 * A two-letter code with no VAT rate stored, for tests that must see a 404 or must create a rate (201).
 * Only the creating tests use up a code; the pool codes are never offered.
 */
export async function unusedCountryCode(tax: TaxClient): Promise<string> {
  const taken = new Set([...(await listVatRates(tax)).map((rate) => rate.countryCode), ...VAT_CODE_POOL]);
  const free = [...LETTERS].flatMap((first) => [...LETTERS].map((second) => first + second))
    .filter((code) => !taken.has(code) && !ALIASED_ALPHA_2.has(code));
  expect(free.length, 'Free two-letter country codes left for VAT tests').toBeGreaterThan(0);
  return free[randomInt(free.length)];
}

/** A three-letter code with no currency stored; see unusedCountryCode. */
export async function unusedCurrencyCode(tax: TaxClient): Promise<string> {
  const taken = new Set([...(await listCurrencies(tax)).map((currency) => currency.code), ...CURRENCY_CODE_POOL]);
  for (let attempt = 0; attempt < 100; attempt++) {
    const code = randomCode(3);
    if (!taken.has(code)) return code;
  }
  throw new Error('No free currency code found');
}

/** Sets a test-owned country code (from the pool) to `rate` and returns the stored row. */
export async function countryWithVat(adminTax: TaxClient, rate: number, countryName = `PW Land ${randomCode(6)}`): Promise<VatRateDto> {
  const countryCode = pooledCode(VAT_CODE_POOL, 'VAT country');
  const response = await adminTax.upsertVatRate(countryCode, { countryName, rate });
  await expect(response, `Set VAT rate of ${countryCode} to ${rate}`).toHaveStatus([200, 201]);
  return response.json();
}

/** Sets a test-owned currency code (from the pool) to `rateToUsd` and returns the stored row. */
export async function currencyWithRate(adminTax: TaxClient, rateToUsd: number, symbol = 'Ƀ'): Promise<CurrencyDto> {
  const code = pooledCode(CURRENCY_CODE_POOL, 'currency');
  const response = await adminTax.upsertCurrency(code, { name: `PW Coin ${code}`, symbol, rateToUsd });
  await expect(response, `Set currency ${code} to ${rateToUsd} USD`).toHaveStatus([200, 201]);
  return response.json();
}

export async function listVatRates(tax: TaxClient): Promise<VatRateDto[]> {
  const response = await tax.vatRates();
  await expect(response, 'List VAT rates').toHaveStatus(200);
  return response.json();
}

export async function getVatRate(tax: TaxClient, country: string): Promise<VatRateDto> {
  const response = await tax.vatRate(country);
  await expect(response, `Read VAT rate of ${country}`).toHaveStatus(200);
  return response.json();
}

export async function listCurrencies(tax: TaxClient): Promise<CurrencyDto[]> {
  const response = await tax.currencies();
  await expect(response, 'List currencies').toHaveStatus(200);
  return response.json();
}

// VAT contained in a VAT-inclusive amount: gross * rate / (100 + rate), half-up to cents; net is the rest.
// Integer cents and basis points keep the expectation exact.
export function vatBreakdown(gross: number, rate: number): { taxAmount: number; netAmount: number } {
  const grossCents = Math.round(gross * 100);
  const rateBasisPoints = Math.round(rate * 100);
  const numerator = grossCents * rateBasisPoints;
  const denominator = 10_000 + rateBasisPoints;
  const taxCents = Math.floor((2 * numerator + denominator) / (2 * denominator));
  return { taxAmount: taxCents / 100, netAmount: (grossCents - taxCents) / 100 };
}

// A FIXED_AMOUNT coupon the test owns, to check that VAT is computed after the discount.
// Coupons belong to another feature, so this helper talks to the endpoint directly and deletes the coupon in `remove`.
export async function createFixedCoupon(api: ApiTestContext, value: number): Promise<{ code: string; applyTo: (shopper: Shopper) => Promise<void>; remove: () => Promise<void> }> {
  const headers = { Authorization: `Bearer ${await api.getAdminToken()}` };
  const code = `PWTAX-${randomCode(10)}`;
  const response = await api.request.post('/api/v1/admin/coupons', { data: { code, type: 'FIXED_AMOUNT', value }, headers });
  await expect(response, `Create coupon ${code}`).toHaveStatus(201);
  const { id } = await response.json();
  return {
    code,
    applyTo: async (shopper) => {
      const applied = await api.request.put('/api/v1/cart/coupon', { data: { code }, headers: { Authorization: `Bearer ${shopper.token}` } });
      await expect(applied, `Apply coupon ${code}`).toHaveStatus(200);
    },
    remove: async () => {
      const deleted = await api.request.delete(`/api/v1/admin/coupons/${id}`, { headers });
      await expect(deleted, `Delete coupon ${code}`).toHaveStatus([204, 404]);
    },
  };
}
