# BUG-WAREHOUSE-01: concurrent fulfilment starves the connection pool and fails with 500 after 30 s

**Status:** fixed in warehouse-service 1.4.1 (2026-11-12); the test asserting it is active again.

**Severity:** high (production uses the same pool size of 3)
**Component:** warehouse-service 1.4.0
**Found by:** the full suite with 6 workers; reproduced by `tests/api/tracking/concurrency.api.spec.ts`

## Steps
1. Create and pay 8 orders.
2. Create, pick, pack and ship their shipments concurrently (`POST /api/v1/warehouse/shipments`, `/pick`, `/pack`, `/ship`).

## Expected
Every call succeeds within a few seconds.

## Actual
Calls hang for 30 s and end with 500:
`HikariPool-1 - Connection is not available, request timed out after 30000ms (total=3, active=3, idle=0, waiting=…)`.

## Cause
Same shape as BUG-PAYMENTS-02, pool size 3:
- `NotificationDispatcher` is an `AFTER_COMMIT` listener running on the request thread before its connection is released,
  opens `REQUIRES_NEW` transactions and `dispatchDue()` is `synchronized` around HTTP calls to the backend.
- `OrderLocks` creates lock rows in a `REQUIRES_NEW` transaction while the caller's transaction holds a connection.
