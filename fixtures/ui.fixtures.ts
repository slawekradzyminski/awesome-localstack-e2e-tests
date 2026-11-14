import type { Browser, Page } from '@playwright/test';
import { ADMIN_PASSWORD, ADMIN_USERNAME, APP_BASE_URL, WAREHOUSE_PASSWORD, WAREHOUSE_USERNAME } from '@config';
import type { LoginDto } from '@models/auth';
import { AdminCurrenciesPage } from '@pages/admin/admin-currencies.page';
import { AdminGiftCardsPage } from '@pages/admin/admin-gift-cards.page';
import { AdminPaymentsPage } from '@pages/admin/admin-payments.page';
import { AdminVatRatesPage } from '@pages/admin/admin-vat-rates.page';
import { AdminWebhooksPage } from '@pages/admin/admin-webhooks.page';
import { NotificationsPage } from '@pages/account/notifications.page';
import { WebhooksPage } from '@pages/account/webhooks.page';
import { CurrencySelector } from '@pages/components/currency-selector.component';
import { CartPage } from '@pages/shop/cart.page';
import { CheckoutPage } from '@pages/shop/checkout.page';
import { LoyaltyPage } from '@pages/shop/loyalty.page';
import { OrderDetailsPage } from '@pages/shop/order-details.page';
import { PaymentPage } from '@pages/shop/payment.page';
import { ProductSearchPage } from '@pages/shop/product-search.page';
import { PublicTrackingPage } from '@pages/shop/public-tracking.page';
import { WarehouseBoardPage } from '@pages/warehouse/warehouse-board.page';
import { WarehouseLocationsPage } from '@pages/warehouse/warehouse-locations.page';
import { signInBrowser } from '@support/browser-session';
import { test as apiTest } from './api.fixtures';

export interface UiFixtures {
  /** The default `page`, signed in as the `shopper` fixture's user. */
  shopperPage: Page;
  /** A page in its own browser context, signed in as the demo admin. */
  adminPage: Page;
  /** A page in its own browser context, signed in as the demo warehouse account. */
  warehousePage: Page;

  // Page objects on the shopper's page.
  productSearchPage: ProductSearchPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
  paymentPage: PaymentPage;
  orderDetailsPage: OrderDetailsPage;
  loyaltyPage: LoyaltyPage;
  webhooksPage: WebhooksPage;
  notificationsPage: NotificationsPage;
  currencySelector: CurrencySelector;
  // Page object on the anonymous default page.
  publicTrackingPage: PublicTrackingPage;
  // Page objects on the admin's page.
  adminPaymentsPage: AdminPaymentsPage;
  adminGiftCardsPage: AdminGiftCardsPage;
  adminVatRatesPage: AdminVatRatesPage;
  adminCurrenciesPage: AdminCurrenciesPage;
  adminWebhooksPage: AdminWebhooksPage;
  // Page object on the warehouse account's page.
  warehouseBoardPage: WarehouseBoardPage;
  warehouseLocationsPage: WarehouseLocationsPage;
}

export const test = apiTest.extend<UiFixtures>({
  shopperPage: async ({ page, context, request, shopper }, use) => {
    await signInBrowser(context, request, { username: shopper.username, password: shopper.user.password });
    await use(page);
  },
  adminPage: async ({ browser, request, baseURL }, use) => {
    await useSignedInPage(browser, request, baseURL, { username: ADMIN_USERNAME, password: ADMIN_PASSWORD }, use);
  },
  warehousePage: async ({ browser, request, baseURL }, use) => {
    await useSignedInPage(browser, request, baseURL, { username: WAREHOUSE_USERNAME, password: WAREHOUSE_PASSWORD }, use);
  },

  productSearchPage: [async ({ shopperPage }, use) => use(new ProductSearchPage(shopperPage)), { box: true }],
  cartPage: [async ({ shopperPage }, use) => use(new CartPage(shopperPage)), { box: true }],
  checkoutPage: [async ({ shopperPage }, use) => use(new CheckoutPage(shopperPage)), { box: true }],
  paymentPage: [async ({ shopperPage }, use) => use(new PaymentPage(shopperPage)), { box: true }],
  orderDetailsPage: [async ({ shopperPage }, use) => use(new OrderDetailsPage(shopperPage)), { box: true }],
  loyaltyPage: [async ({ shopperPage }, use) => use(new LoyaltyPage(shopperPage)), { box: true }],
  webhooksPage: [async ({ shopperPage }, use) => use(new WebhooksPage(shopperPage)), { box: true }],
  notificationsPage: [async ({ shopperPage }, use) => use(new NotificationsPage(shopperPage)), { box: true }],
  currencySelector: [async ({ shopperPage }, use) => use(new CurrencySelector(shopperPage)), { box: true }],
  publicTrackingPage: [async ({ page }, use) => use(new PublicTrackingPage(page)), { box: true }],
  adminPaymentsPage: [async ({ adminPage }, use) => use(new AdminPaymentsPage(adminPage)), { box: true }],
  adminGiftCardsPage: [async ({ adminPage }, use) => use(new AdminGiftCardsPage(adminPage)), { box: true }],
  adminVatRatesPage: [async ({ adminPage }, use) => use(new AdminVatRatesPage(adminPage)), { box: true }],
  adminCurrenciesPage: [async ({ adminPage }, use) => use(new AdminCurrenciesPage(adminPage)), { box: true }],
  adminWebhooksPage: [async ({ adminPage }, use) => use(new AdminWebhooksPage(adminPage)), { box: true }],
  warehouseBoardPage: [async ({ warehousePage }, use) => use(new WarehouseBoardPage(warehousePage)), { box: true }],
  warehouseLocationsPage: [async ({ warehousePage }, use) => use(new WarehouseLocationsPage(warehousePage)), { box: true }],
});

async function useSignedInPage(
  browser: Browser,
  request: Parameters<typeof signInBrowser>[1],
  baseURL: string | undefined,
  credentials: LoginDto,
  use: (page: Page) => Promise<void>,
): Promise<void> {
  const context = await browser.newContext({ baseURL: baseURL ?? APP_BASE_URL });
  try {
    await signInBrowser(context, request, credentials);
    await use(await context.newPage());
  } finally {
    await context.close();
  }
}
