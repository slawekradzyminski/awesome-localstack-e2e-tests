import { test, expect } from '@fixtures';
import { reservedUntilLabel } from '@pages/components/reservation-countdown.component';

test.describe('order reservation countdown', { tag: ['@orders', '@reservations'] }, () => {
  test('a pending order shows until when its stock is reserved and counts down', async ({ shopper, orderDetailsPage }) => {
    // given
    const { order } = await shopper.placeOrder(35);

    // when
    await orderDetailsPage.goto(order.id);

    // then
    await expect(orderDetailsPage.reservation.until).toHaveText(reservedUntilLabel(order.reservationExpiresAt!));
    await expect(orderDetailsPage.reservation.remaining).toHaveText(/^(29|30):\d\d left to pay$/);
    const first = await orderDetailsPage.reservation.remaining.textContent();
    await expect(orderDetailsPage.reservation.remaining).not.toHaveText(first!);
    await expect(orderDetailsPage.reservation.expired).toBeHidden();
  });

  test('the payment page shows the reservation too', async ({ shopper, paymentPage }) => {
    // given
    const { order } = await shopper.placeOrder(35);

    // when
    await paymentPage.goto(order.id);

    // then
    await expect(paymentPage.reservation.until).toHaveText(reservedUntilLabel(order.reservationExpiresAt!));
  });

  test('an order whose reservation expired says so instead of counting down', async ({ shopper, admin, orderDetailsPage }) => {
    // given
    const { order } = await shopper.placeOrder(35);
    await expect(await admin.orders.expireReservation(order.id), 'Expire the reservation').toHaveStatus(200);

    // when
    await orderDetailsPage.goto(order.id);

    // then
    await expect(orderDetailsPage.status).toHaveText(/cancelled/i);
    await expect(orderDetailsPage.reservation.expired).toContainText('Reservation expired');
    await expect(orderDetailsPage.reservation.root).toBeHidden();
  });

  test('a paid order shows no countdown', async ({ shopper, orderDetailsPage }) => {
    // given
    const { order } = await shopper.placeOrder(35);
    await shopper.payAndWaitForPaid(order.id);

    // when
    await orderDetailsPage.goto(order.id);

    // then
    await expect(orderDetailsPage.status).toHaveText(/paid/i);
    await expect(orderDetailsPage.reservation.root).toBeHidden();
  });
});
