import { ApiClient, segment, type Query } from './api-client';

export class TaxClient extends ApiClient {
  vatRates() {
    return this.get('/api/v1/vat-rates');
  }

  // Country code or name, case-insensitive.
  vatRate(country: string) {
    return this.get(`/api/v1/vat-rates/${segment(country)}`);
  }

  // ROLE_ADMIN
  upsertVatRate(countryCode: string, rate: { countryName: string; rate: number }) {
    return this.put(`/api/v1/admin/vat-rates/${segment(countryCode)}`, rate);
  }

  currencies() {
    return this.get('/api/v1/currencies');
  }

  convert(amount: number | string, from: string, to: string) {
    return this.get('/api/v1/currencies/convert', { amount, from, to });
  }

  // Raw query parameters, so tests can omit or malform any of them.
  convertWithParams(params: Query) {
    return this.get('/api/v1/currencies/convert', params);
  }

  // ROLE_ADMIN
  upsertCurrency(code: string, currency: { name: string; symbol: string; rateToUsd: number }) {
    return this.put(`/api/v1/admin/currencies/${segment(code)}`, currency);
  }
}
