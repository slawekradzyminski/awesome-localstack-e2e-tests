import type { Locator, Page } from '@playwright/test';
import type { ShipmentStatus } from '@models/shipment';
import { BasePage } from '@pages/base.page';

/** /warehouse: the shipment board with the simulated-carrier controls of the selected shipment. */
export class WarehouseBoardPage extends BasePage {
  readonly statusFilter: Locator;
  readonly notice: Locator;
  readonly selectedTitle: Locator;
  readonly selectedTracking: Locator;

  constructor(page: Page) {
    super(page);
    this.statusFilter = page.getByTestId('warehouse-filter');
    this.notice = page.getByTestId('warehouse-notice');
    this.selectedTitle = page.getByTestId('warehouse-selected-title');
    this.selectedTracking = page.getByTestId('warehouse-selected-tracking');
  }

  async goto(): Promise<void> {
    await this.page.goto('/warehouse');
  }

  carrierStatus(shipmentId: number): Locator {
    return this.page.getByTestId(`warehouse-carrier-status-${shipmentId}`);
  }

  advanceButton(shipmentId: number): Locator {
    return this.page.getByTestId(`warehouse-advance-${shipmentId}`);
  }

  deliverButton(shipmentId: number): Locator {
    return this.page.getByTestId(`warehouse-deliver-${shipmentId}`);
  }

  /** Filters the board by status and selects the shipment. */
  async select(shipmentId: number, status: ShipmentStatus = 'SHIPPED'): Promise<void> {
    await this.statusFilter.selectOption(status);
    await this.page.getByTestId(`warehouse-shipment-${shipmentId}`).click();
  }

  /** Moves the simulated parcel on by one carrier scan. */
  async advanceCarrier(shipmentId: number): Promise<void> {
    await this.advanceButton(shipmentId).click();
  }
}
