import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';
import { TrackingTimeline } from '@pages/components/tracking-timeline.component';

/** Anonymous parcel tracking: /track and /track/:number. */
export class PublicTrackingPage extends BasePage {
  readonly root: Locator;
  readonly title: Locator;
  readonly input: Locator;
  readonly submitButton: Locator;
  readonly inputError: Locator;
  readonly result: Locator;
  readonly loading: Locator;
  readonly notFound: Locator;
  readonly error: Locator;
  readonly timeline: TrackingTimeline;

  constructor(page: Page) {
    super(page);
    this.root = page.getByTestId('public-tracking-page');
    this.title = page.getByTestId('public-tracking-title');
    this.input = page.getByLabel('Tracking number', { exact: true });
    this.submitButton = page.getByTestId('public-tracking-submit');
    this.inputError = page.getByTestId('public-tracking-input-error');
    this.result = page.getByTestId('public-tracking-result');
    this.loading = page.getByTestId('public-tracking-loading');
    this.notFound = page.getByTestId('public-tracking-not-found');
    this.error = page.getByTestId('public-tracking-error');
    this.timeline = new TrackingTimeline(this.result);
  }

  /** The search form, or the result page of one tracking number. */
  async goto(trackingNumber?: string): Promise<void> {
    await this.page.goto(trackingNumber === undefined ? '/track' : `/track/${encodeURIComponent(trackingNumber)}`);
  }

  async track(trackingNumber: string): Promise<void> {
    await this.input.fill(trackingNumber);
    await this.submitButton.click();
  }
}
