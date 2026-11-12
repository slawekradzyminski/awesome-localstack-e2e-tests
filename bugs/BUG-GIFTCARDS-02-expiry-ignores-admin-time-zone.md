# BUG-GIFTCARDS-02: Gift card expiry picked in the admin UI is shifted by the browser's UTC offset

**Status:** fixed in frontend 3.12.1 (2026-11-12); the test asserting it is active again.

## Environment
- Local awesome-localstack (`http://localhost:8081`), frontend 3.12.0, backend 3.17.0 (server clock in UTC)
- Page: `/admin/gift-cards`, "Issue a gift card" form, field "Expires (optional)" (`datetime-local`)

## Steps
1. Open `/admin/gift-cards` as `admin` in a browser whose time zone is not UTC, e.g. `Pacific/Auckland` (UTC+13 in November).
2. Pick an expiry three hours from now in the browser's local time (e.g. local 2026-11-12 23:58 = 2026-11-12 10:58 UTC).
3. Issue the card and read it back:
   `curl -s -A curl http://localhost:8081/api/v1/admin/gift-cards/<code> -H "Authorization: Bearer $ADMIN_TOKEN"`

## Expected
The card expires at the instant the administrator picked (`expiresAt` = 2026-11-12T10:58 in the server's UTC local time),
or the form states clearly that the expiry is in server time.

## Actual
The form sends the browser-local wall time without an offset (`toRequest`: `${form.expiresAt}:00`) and the backend
stores it as server-local (UTC) time, so `expiresAt` is `2026-11-12T23:58` — the card lives 13 hours longer than chosen.
West of UTC the card expires early, and a near-term expiry that the client-side check accepts ("Expiry must be in the
future") is rejected by the server with `400 expiresAt must be in the future`.
The details drawer re-parses the zone-less value as browser-local time, so the admin UI itself looks consistent and hides
the shift; customers (balance checker, other zones) see a different expiry.

## Evidence
- `tests/ui/gift-cards/admin-gift-cards.ui.spec.ts` — "an expiry picked in a browser east of the server zone is stored as the same instant" (fixme).
  Observed: `Expected "2026-11-12T10:58"`, `Received "2026-11-12T23:58"`.
- Frontend `src/components/admin/AdminGiftCards.tsx` `toRequest()`; backend `GiftCardCreateDto.expiresAt` is a `LocalDateTime`
  documented as "Server-local end of validity".
