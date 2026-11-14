import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';
import { ReservationCountdown } from '@pages/components/reservation-countdown.component';
import { expect } from '@support/expect';
import { CardForm } from './card-form.component';
import { ThreeDsDialog } from './three-ds-dialog.component';

/** /orders/:id/pay: the amount summary with gift card and points, the card form and every payment outcome. */
export class PaymentPage extends BasePage {
  readonly title: Locator;
  readonly orderNotFound: Locator;
  readonly total: Locator;
  readonly giftCard: Locator;
  readonly points: Locator;
  readonly amountDue: Locator;
  readonly cardForm: CardForm;
  readonly threeDs: ThreeDsDialog;
  readonly processing: Locator;
  readonly success: Locator;
  readonly successDetails: Locator;
  readonly successOrderLink: Locator;
  readonly failedMessage: Locator;
  readonly tryAnotherCardButton: Locator;
  readonly challenge: Locator;
  readonly reopenChallengeButton: Locator;
  readonly inProgress: Locator;
  readonly resumeButton: Locator;
  readonly notPayableMessage: Locator;
  readonly alreadyPaid: Locator;
  readonly cancelled: Locator;
  readonly paidByTenders: Locator;
  readonly reservation: ReservationCountdown;

  constructor(page: Page) {
    super(page);
    this.reservation = new ReservationCountdown(page);
    this.title = page.getByTestId('payment-title');
    this.orderNotFound = page.getByTestId('payment-order-not-found');
    this.total = page.getByTestId('payment-order-total');
    this.giftCard = page.getByTestId('payment-order-gift-card');
    this.points = page.getByTestId('payment-order-points');
    this.amountDue = page.getByTestId('payment-order-amount-due');
    this.cardForm = new CardForm(page);
    this.threeDs = new ThreeDsDialog(page);
    this.processing = page.getByTestId('payment-processing');
    this.success = page.getByTestId('payment-success');
    this.successDetails = page.getByTestId('payment-success-details');
    this.successOrderLink = page.getByTestId('payment-success-order-link');
    this.failedMessage = page.getByTestId('payment-failed-message');
    this.tryAnotherCardButton = page.getByTestId('payment-try-another-card');
    this.challenge = page.getByTestId('payment-challenge');
    this.reopenChallengeButton = page.getByTestId('payment-3ds-reopen');
    this.inProgress = page.getByTestId('payment-in-progress');
    this.resumeButton = page.getByTestId('payment-resume');
    this.notPayableMessage = page.getByTestId('payment-not-payable-message');
    this.alreadyPaid = page.getByTestId('payment-already-paid');
    this.cancelled = page.getByTestId('payment-order-cancelled');
    this.paidByTenders = page.getByTestId('payment-paid-by-tenders');
  }

  async goto(orderId: number): Promise<void> {
    await this.page.goto(paymentPath(orderId));
    await this.title.or(this.orderNotFound).waitFor();
  }

  async tryAnotherCard(): Promise<void> {
    await this.tryAnotherCardButton.click();
  }

  async reopenChallenge(): Promise<void> {
    await this.reopenChallengeButton.click();
  }

  async resumePayment(): Promise<void> {
    await this.resumeButton.click();
  }

  async openOrder(): Promise<void> {
    await this.successOrderLink.click();
  }

  async expectOpenFor(orderId: number): Promise<void> {
    await expect(this.page).toHaveURL(paymentPath(orderId));
  }
}

const paymentPath = (orderId: number) => `/orders/${orderId}/pay`;
