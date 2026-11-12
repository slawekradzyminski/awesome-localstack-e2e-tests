# BUG-SERVICES-01: concurrent first requests after a start or key rotation get 401

**Status:** fixed in payment-service 1.2.1 and warehouse-service 1.4.1 (2026-11-12).
**Severity:** medium
**Found by:** the concurrency regression tests for BUG-PAYMENTS-02 and BUG-WAREHOUSE-01.

## Cause
Both services verify user JWTs with the backend's signing keys, fetched on demand and rate-limited. When several
requests arrived before the keys were cached, one thread fetched them and the others were throttled, found no key
and answered 401.

## Fix
The other requests now wait for the one fetch in progress, check the cache again, and the whole key map is replaced at once.
