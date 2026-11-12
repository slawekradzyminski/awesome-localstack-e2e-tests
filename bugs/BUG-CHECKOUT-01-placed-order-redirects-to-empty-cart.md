# BUG-CHECKOUT-01: after placing an order the customer can land on the empty cart instead of the payment page

**Status:** fixed in frontend 3.12.2 (2026-11-12); the tests asserting it are active again.
**Severity:** high (the customer is sent away from paying for the order they just placed)
**Found by:** `tests/ui/gift-cards/tender-checkout.ui.spec.ts` on the GitHub Actions runner (failed on the first attempt and on the retry; passes on a fast laptop).

## Deterministic reproduction
`tests/ui/payments/checkout-to-payment.ui.spec.ts` throttles Chromium's CPU 6x through CDP
(`Emulation.setCPUThrottlingRate`) before placing the order: it fails 4 out of 4 runs against frontend 3.12.0 and 3.12.1,
ending on "Your cart is empty". Throttling the network (delayed scripts or API calls) does not reproduce it.

## Steps
1. Put a product in the cart and open `/checkout`.
2. Fill the address and place the order on a slower machine or network (e.g. CI runner, CPU throttling).

## Expected
The browser stays on `/orders/{id}/pay` with the card form.

## Actual
The URL briefly becomes `/orders/{id}/pay`, then `/cart` (empty cart). The order was created (201) and is PENDING.

## Evidence
Trace of CI run 43205600565: `POST /api/v1/orders 201` → navigated to `/orders/203/pay` → `GET /api/v1/cart` (empty) → `/cart`; no request for order 203 was ever made.

## Cause
`CheckoutForm`'s `onSuccess` invalidates `['cart']` and navigates to the pay page. While the pay page's lazy route
is still loading, `CheckoutPage` stays mounted, receives the refetched empty cart and renders `<Navigate to="/cart" />`,
which overrides the navigation to the payment page.

## Fix (frontend 3.12.2)
React Router runs every navigation inside `startTransition`, so the urgent update from the refetched empty cart won
over the pending navigation. `CheckoutForm` now reports the placed order first, navigates with `replace`, and only then
refreshes the cart; `CheckoutPage` shows "Order placed. Opening payment…" instead of redirecting once it placed an order.
