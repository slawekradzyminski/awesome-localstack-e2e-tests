# BUG-INVENTORY-01: checkout right after a product is created answers 404 "Product not found"

**Status:** open, found on the candidate images backend 3.22.0 (`backend-inv:native-3.22.0`) and
warehouse-service 1.6.0 (`warehouse-service:inv-native`), not released. The tests that catch it are not marked
`test.fixme`, because they still guard the released stack.

**Severity:** high (a product that the admin has just created cannot be bought for a short time, and the error says
that the product does not exist)
**Component:** backend 3.22.0, stock commands (contract section 4.3)
**Found by:** the first full run against the candidate images. `tests/api/tracking/concurrency.api.spec.ts` and
`tests/api/payments/concurrency.api.spec.ts` create 8 products and check out straight away. 11 of the checkouts
in that run got a 404, and payments passed only on retry.

## Steps
1. `POST /api/v1/products` (admin) with `stockQuantity: 50` → 201, product id 171.
2. Add the product to a cart (`POST /api/v1/cart/items` → 200).
3. `POST /api/v1/orders` straight away, within a few milliseconds, while other products are being created.

## Expected
201: the order is placed. The product exists and has stock 50 in `GET /api/v1/products/171`.

## Actual
```
POST /api/v1/orders → 404
{"message" : "Product not found"}
```
warehouse-service logs `Stock item of product 171 created with 50 units` only after the checkouts had failed
(21:09:16.466–.558 for products 171–178 in that run).

## Cause (suspected)
`ProductService.create` records an `INITIAL_STOCK` row in `stock_command_outbox`, and
`StockCommandOutbox.dispatchAfterCommit` only schedules `StockCommandDispatcher.dispatchSoon()` on the task
scheduler. The 201 is sent before warehouse-service has the stock item. Checkout's reserve call
(`POST /internal/v1/stock/reservations`) then gets warehouse's 404 for an unknown stock item, and the backend
maps it to the public 404 "Product not found".

Possible fixes: send the `INITIAL_STOCK` command on the request thread after commit (the outbox stays as the
fallback for retries), or have checkout handle a reserve 404 for a product the backend knows about by sending
that product's pending stock commands and reserving once more.
