/**
 * The one entry point for specs: `import { test, expect } from '@fixtures';`
 *
 * `test` carries the API fixtures (api, shopper, otherShopper, admin, warehouse, parcels) and the UI
 * fixtures (signed-in pages and page objects). Fixtures are lazy, so an API spec never starts a browser.
 * `expect` adds `toHaveStatus` for API responses.
 */
export { test } from './ui.fixtures';
export type { ApiFixtures } from './api.fixtures';
export type { UiFixtures } from './ui.fixtures';
export { expect } from '@support/expect';
