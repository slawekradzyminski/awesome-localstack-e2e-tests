# BUG-GIFTCARDS-03: Disabling a gift card answers with the old updatedAt

## Environment
- Local awesome-localstack (`http://localhost:8081`), backend 3.17.0
- Endpoint: `POST /api/v1/admin/gift-cards/{code}/disable` (ROLE_ADMIN)

## Steps
```bash
B=http://localhost:8081
TOKEN=$(curl -s -A curl -X POST $B/api/v1/users/signin -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"LocalDemoAdmin123!"}' | jq -r .token)
CODE=$(curl -s -A curl -X POST $B/api/v1/admin/gift-cards -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' -d '{"amount":3}' | jq -r .code)
sleep 1
curl -s -A curl -X POST $B/api/v1/admin/gift-cards/$CODE/disable -H "Authorization: Bearer $TOKEN" | jq .updatedAt
curl -s -A curl $B/api/v1/admin/gift-cards/$CODE -H "Authorization: Bearer $TOKEN" | jq .updatedAt
```

## Expected
The disable response reflects the stored card: `status: DISABLED` and the new `updatedAt` written by the change
(the same value a following `GET /api/v1/admin/gift-cards/{code}` returns).

## Actual
The response still carries the issue-time `updatedAt` (`2026-11-12T07:59:09.524501`), while the following GET returns
the real one (`2026-11-12T07:59:10.575507`). `GiftCardService.disable` maps the entity to the DTO before the
`@UpdateTimestamp` value is flushed. Clients that cache the response (or use updatedAt for optimistic checks) see stale data.

## Evidence
- `tests/api/gift-cards/gift-card-details.api.spec.ts` — "the disable response carries the same updatedAt as the stored card - 200" (fixme)
