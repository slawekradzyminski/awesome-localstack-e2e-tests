import type { Locator, Page } from '@playwright/test';
import type { WarehouseLocationCode } from '@models/shipment';
import { BasePage } from '@pages/base.page';

/** /warehouse/locations: the locations with their active switch, and the reconciliation with the backend. */
export class WarehouseLocationsPage extends BasePage {
  readonly root: Locator;
  readonly reconciliation: Locator;
  readonly reconciliationRefresh: Locator;

  constructor(page: Page) {
    super(page);
    this.root = page.getByTestId('warehouse-locations');
    this.reconciliation = page.getByTestId('warehouse-reconciliation');
    this.reconciliationRefresh = page.getByTestId('warehouse-reconciliation-refresh');
  }

  async goto(): Promise<void> {
    await this.page.goto('/warehouse/locations');
    await this.name('KRK').waitFor();
  }

  name(code: WarehouseLocationCode): Locator {
    return this.page.getByTestId(`warehouse-location-name-${code}`);
  }

  primary(code: WarehouseLocationCode): Locator {
    return this.page.getByTestId(`warehouse-location-primary-${code}`);
  }

  backup(code: WarehouseLocationCode): Locator {
    return this.page.getByTestId(`warehouse-location-backup-${code}`);
  }

  status(code: WarehouseLocationCode): Locator {
    return this.page.getByTestId(`warehouse-location-status-${code}`);
  }

  toggle(code: WarehouseLocationCode): Locator {
    return this.page.getByTestId(`warehouse-location-toggle-${code}`);
  }

  reconciliationRow(orderId: number): Locator {
    return this.page.getByTestId(`warehouse-reconciliation-${orderId}`);
  }

  async switchOff(code: WarehouseLocationCode): Promise<void> {
    await this.toggle(code).click();
  }
}
