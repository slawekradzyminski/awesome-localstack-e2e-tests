import type { Locator, Page } from '@playwright/test';
import { TrackingTimeline } from '@pages/components/tracking-timeline.component';

/** Delivery section of /orders/:id: warehouse shipment steps and the carrier tracking timeline. */
export class OrderShipment {
  readonly root: Locator;
  readonly none: Locator;
  readonly status: Locator;
  readonly carrierAndNumber: Locator;
  readonly tracking: Locator;
  readonly publicTrackingLink: Locator;
  readonly timeline: TrackingTimeline;

  constructor(page: Page) {
    this.root = page.getByTestId('order-fulfilment');
    this.none = page.getByTestId('order-shipment-none');
    this.status = page.getByTestId('order-shipment-status');
    this.carrierAndNumber = page.getByTestId('order-shipment-tracking');
    this.tracking = page.getByTestId('order-tracking');
    this.publicTrackingLink = page.getByTestId('order-tracking-public-link');
    this.timeline = new TrackingTimeline(this.tracking);
  }

  async openPublicTracking(): Promise<void> {
    await this.publicTrackingLink.click();
  }
}
