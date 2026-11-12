import type { Locator } from '@playwright/test';
import type { TrackingStatus } from '@models/shipment';
import { expect } from '@support/expect';

/** Status labels of the frontend's TrackingTimeline (src/lib/tracking.ts). */
export const TRACKING_LABELS: Record<TrackingStatus, string> = {
  LABEL_CREATED: 'Label created',
  IN_TRANSIT: 'In transit',
  OUT_FOR_DELIVERY: 'Out for delivery',
  DELIVERY_FAILED: 'Delivery attempt failed',
  DELIVERED: 'Delivered',
};

/** Carrier scans of one parcel, newest first; shown on the order details and the public tracking page. */
export class TrackingTimeline {
  readonly currentStatus: Locator;
  readonly carrier: Locator;
  readonly trackingNumber: Locator;
  readonly copyNumberButton: Locator;
  readonly copyStatus: Locator;
  readonly estimatedDelivery: Locator;
  readonly events: Locator;

  constructor(readonly root: Locator) {
    this.currentStatus = root.getByTestId('tracking-current-status');
    this.carrier = root.getByTestId('tracking-carrier');
    this.trackingNumber = root.getByTestId('tracking-number');
    this.copyNumberButton = root.getByTestId('tracking-copy-number');
    this.copyStatus = root.getByTestId('tracking-copy-status');
    this.estimatedDelivery = root.getByTestId('tracking-estimated-delivery');
    this.events = root.getByTestId('tracking-events').getByRole('listitem');
  }

  /** tracking-event-<n> numbers scans from the oldest (0); the list shows the newest first. */
  event(index: number): TrackingEvent {
    const root = this.root.getByTestId(`tracking-event-${index}`);
    return {
      root,
      description: root.getByTestId('tracking-event-description'),
      location: root.getByTestId('tracking-event-location'),
    };
  }

  async copyNumber(): Promise<void> {
    await this.copyNumberButton.click();
  }

  /** The scan statuses, given oldest first, as the timeline shows them (newest first). */
  async expectScans(statusesOldestFirst: TrackingStatus[]): Promise<void> {
    await expect(this.events).toHaveCount(statusesOldestFirst.length);
    const newestFirst = [...statusesOldestFirst].reverse();
    await expect(this.events.getByTestId('tracking-event-status')).toHaveText(newestFirst.map((status) => TRACKING_LABELS[status]));
  }
}

export interface TrackingEvent {
  root: Locator;
  description: Locator;
  location: Locator;
}
