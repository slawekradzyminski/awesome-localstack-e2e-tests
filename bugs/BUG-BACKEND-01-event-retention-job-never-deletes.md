# BUG-BACKEND-01: the scheduled event-feed retention job fails on every run, so old events are never deleted

**Status:** fixed in backend 3.17.1 (2026-11-12).
**Severity:** medium (the `domain_events` table grows without limit in production)
**Found by:** the backend log of a full suite run: `TransactionRequiredException: No active transaction for update or delete query`.

## Cause
`DomainEventRetentionJob`'s scheduled method called its own `@Transactional purge()` method from inside the class.
Spring's proxy never sees a self-call, so the delete ran without a transaction and failed every time. The unit tests
called `purge()` through the Spring bean, which is why they passed.

## Fix
The repository's delete query opens its own transaction; a test now runs the scheduled entry point.
