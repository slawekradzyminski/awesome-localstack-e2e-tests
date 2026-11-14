import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';
import { ReservationCountdown } from '@pages/components/reservation-countdown.component';
import { expect } from '@support/expect';
import { OrderPaymentPanel } from './order-payment-panel.component';
import { OrderShipment } from './order-shipment.component';
import { OrderVat } from './order-vat.component';

/** /orders/:id: status, total with its VAT, card payments and delivery tracking. */
export class OrderDetailsPage extends BasePage {
  readonly status: Locator;
  readonly total: Locator;
  readonly vat: OrderVat;
  readonly payment: OrderPaymentPanel;
  readonly shipment: OrderShipment;
  readonly reservation: ReservationCountdown;

  constructor(page: Page) {
    super(page);
    this.status = page.getByTestId('order-details-status');
    this.total = page.getByTestId('order-details-total-amount');
    this.vat = new OrderVat(page);
    this.payment = new OrderPaymentPanel(page);
    this.shipment = new OrderShipment(page);
    this.reservation = new ReservationCountdown(page);
  }

  async goto(orderId: number): Promise<void> {
    await this.page.goto(orderPath(orderId));
    await this.status.waitFor();
  }

  async expectOpenFor(orderId: number): Promise<void> {
    await expect(this.page).toHaveURL(orderPath(orderId));
  }
}

const orderPath = (orderId: number) => `/orders/${orderId}`;
