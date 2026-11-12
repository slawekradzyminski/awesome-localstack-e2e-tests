import type { AddressDto } from '@models/order';

// VAT comes from the shipping country (code or name). Rates seeded by the backend: PL 23, DE 19.
export const addresses = {
  poland: { street: 'Marszalkowska 1', city: 'Warszawa', state: 'MZ', zipCode: '00-001', country: 'Poland' },
  germany: { street: 'Unter den Linden 5', city: 'Berlin', state: 'BE', zipCode: '10117', country: 'DE' },
} satisfies Record<string, AddressDto>;
