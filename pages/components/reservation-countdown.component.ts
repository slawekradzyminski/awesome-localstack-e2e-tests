import type { Locator, Page } from '@playwright/test';

/** "Reserved until HH:MM" with a live countdown on PENDING orders, "Reservation expired" once cancelled for it (frontend 3.15.0). */
export class ReservationCountdown {
  readonly root: Locator;
  readonly until: Locator;
  readonly remaining: Locator;
  readonly expired: Locator;

  constructor(page: Page) {
    this.root = page.getByTestId('reservation-countdown');
    this.until = page.getByTestId('reservation-countdown-until');
    this.remaining = page.getByTestId('reservation-countdown-remaining');
    this.expired = page.getByTestId('reservation-expired');
  }
}

/** Local HH:MM of an instant, as the countdown shows it. */
export function reservedUntilLabel(instant: string): string {
  const date = new Date(instant);
  return `Reserved until ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
