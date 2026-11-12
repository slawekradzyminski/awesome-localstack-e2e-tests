# BUG-BACKEND-02: deleting a user fails with 500 while an email event for them is being recorded

**Status:** fixed in backend 3.17.1 (2026-11-12).
**Severity:** medium
**Found by:** the suite's user cleanup after tracking tests, once warehouse notifications arrived asynchronously.

## Steps
1. A customer has an order that the warehouse ships (the backend records an ORDER_SHIPPED email event).
2. At the same moment, an admin sends `DELETE /api/v1/users/{username}`.

## Expected
204, the user and their email events are gone.

## Actual
500: `update or delete on table "app_user" violates foreign key constraint "email_event_user_id_fkey"`.

## Cause and fix
`UserService.forget()` deleted the user's email events, then other dependent rows, then the user. An email event committed
in that window. The delete now locks the user row first, recording an event takes a shared lock on it, and nothing is
recorded or sent for a user that is gone.
