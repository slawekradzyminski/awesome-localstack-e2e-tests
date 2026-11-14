import type { Locator, Page } from '@playwright/test';
import { TrackingTimeline } from '@pages/components/tracking-timeline.component';

/**
 * One parcel of the order (frontend 3.15.0, `parcel-<n>`): where it ships from, its lines, its
 * warehouse steps and, once shipped, the carrier tracking timeline.
 */
export class OrderParcel {
  readonly root: Locator;
  readonly title: Locator;
  readonly status: Locator;
  readonly location: Locator;
  readonly lines: Locator;
  readonly carrierAndNumber: Locator;
  readonly tracking: Locator;
  readonly publicTrackingLink: Locator;
  readonly timeline: TrackingTimeline;

  constructor(page: Page, index: number) {
    const prefix = `parcel-${index}`;
    this.root = page.getByTestId(prefix);
    this.title = page.getByTestId(`${prefix}-title`);
    this.status = page.getByTestId(`${prefix}-status`);
    this.location = page.getByTestId(`${prefix}-location`);
    this.lines = page.getByTestId(`${prefix}-lines`).getByRole('listitem');
    this.carrierAndNumber = page.getByTestId(`${prefix}-tracking-number`);
    this.tracking = page.getByTestId(`${prefix}-tracking`);
    this.publicTrackingLink = page.getByTestId(`${prefix}-tracking-public-link`);
    this.timeline = new TrackingTimeline(this.tracking);
  }

  line(productId: number): Locator {
    return this.root.getByTestId(new RegExp(`^parcel-\\d+-line-${productId}$`));
  }

  async openPublicTracking(): Promise<void> {
    await this.publicTrackingLink.click();
  }
}

/** Delivery section of /orders/:id: one card per parcel; a single-location order has one. */
export class OrderShipment {
  readonly root: Locator;
  readonly none: Locator;
  readonly parcels: Locator;
  readonly parcelCount: Locator;

  constructor(private readonly page: Page) {
    this.root = page.getByTestId('order-fulfilment');
    this.none = page.getByTestId('order-shipment-none');
    this.parcels = page.getByTestId('order-parcels').getByTestId(/^parcel-\d+$/);
    this.parcelCount = page.getByTestId('order-parcel-count');
  }

  /** Parcels are numbered from 1 in allocation order (Krakow before Gdansk). */
  parcel(index: number): OrderParcel {
    return new OrderParcel(this.page, index);
  }
}
