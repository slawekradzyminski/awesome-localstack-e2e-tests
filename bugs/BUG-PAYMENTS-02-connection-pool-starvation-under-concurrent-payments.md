# BUG-PAYMENTS-02: concurrent payments starve the connection pool and fail with 500 after 30 s

**Status:** fixed in payment-service 1.2.1 (2026-11-12); the test asserting it is active again.

**Severity:** high (production uses the same pool size of 3)
**Component:** payment-service 1.2.0
**Found by:** the full suite with 6 workers; reproduced by `tests/api/payments/concurrency.api.spec.ts`

## Steps
1. Create 8 orders for 8 customers.
2. Send `POST /api/v1/payments` for all of them at the same moment (card 4242 4242 4242 4242).

## Expected
All 8 payments are created (201) within a few seconds.

## Actual
Requests hang for 30 s and some end with 500:
`HikariPool-1 - Connection is not available, request timed out after 30000ms (total=3, active=3, idle=0, waiting=5)`.

## Cause
`spring.datasource.hikari.maximum-pool-size` is 3, and one request needs two connections at once:
- `PaymentService.create` holds connection #1 in its `@Transactional` method; the first payment of an order calls
  `OrderPaymentLocks.lock()`, which inserts the lock row in a `REQUIRES_NEW` transaction and needs connection #2.
- `PaymentResultDispatcher.afterEnqueue` runs on the request thread `AFTER_COMMIT`, before the request's connection is
  released, opens `REQUIRES_NEW` transactions (connection #2), and is `synchronized` while it calls the backend over HTTP,
  so other threads wait on the monitor while still holding their connections.
Three concurrent requests each holding one connection and waiting for a second block the pool until Hikari times out.
