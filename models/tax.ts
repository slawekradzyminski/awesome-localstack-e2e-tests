export interface VatRateDto {
  countryCode: string;
  countryName: string;
  rate: number;
  updatedAt: string;
}

export interface CurrencyDto {
  code: string;
  name: string;
  symbol: string;
  rateToUsd: number;
  updatedAt: string;
}

