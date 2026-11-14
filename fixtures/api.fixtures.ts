import { test as base } from '@playwright/test';
import { ApiTestContext } from '@support/api-test-context';
import { Shopper } from '@support/shopper';
import { Admin, Warehouse } from '@support/staff';
import { Locations } from '@support/locations';
import { Parcels } from '@support/tracking';

export interface ApiFixtures {
  /** Request context that owns the users and products a test creates and deletes them afterwards. */
  api: ApiTestContext;
  /** A freshly registered customer with every customer-facing client bound to their token. */
  shopper: Shopper;
  /** A second customer, for ownership and isolation checks. */
  otherShopper: Shopper;
  /** The stack's demo admin account. */
  admin: Admin;
  /** The stack's demo warehouse account. */
  warehouse: Warehouse;
  /** Ships paid orders to the simulated carrier and delivers every leftover parcel after the test. */
  parcels: Parcels;
  /** Exclusive use of the warehouse locations (stack-wide state); switches every location back on afterwards. */
  locations: Locations;
}

/** Fixtures for API-level tests; the UI fixtures build on them. Every fixture is created on first use only. */
export const test = base.extend<ApiFixtures>({
  api: [
    async ({ request }, use) => {
      const context = new ApiTestContext(request);
      try {
        await use(context);
      } finally {
        await context.cleanup();
      }
    },
    { box: true },
  ],
  shopper: async ({ api }, use) => use(await Shopper.create(api)),
  otherShopper: async ({ api }, use) => use(await Shopper.create(api)),
  admin: async ({ api }, use) => use(await Admin.create(api)),
  warehouse: async ({ api }, use) => use(await Warehouse.create(api)),
  parcels: async ({ warehouse }, use) => {
    const parcels = new Parcels(warehouse);
    try {
      await use(parcels);
    } finally {
      await parcels.deliverAll();
    }
  },
  locations: async ({ warehouse }, use) => {
    const locations = await Locations.lock(warehouse);
    try {
      await use(locations);
    } finally {
      await locations.unlock();
    }
  },
});
