# BUG-GIFTCARDS-01: Unknown gift card status filter answers with a Java class name instead of the documented ErrorDto

**Status:** fixed in backend 3.17.1 (2026-11-12); the test asserting it is active again.

## Environment
- Local awesome-localstack (`http://localhost:8081`), backend 3.17.0
- Endpoint: `GET /api/v1/admin/gift-cards?status=...` (ROLE_ADMIN)

## Steps
```bash
TOKEN=$(curl -s -A curl -X POST http://localhost:8081/api/v1/users/signin \
  -H 'Content-Type: application/json' -d '{"username":"admin","password":"LocalDemoAdmin123!"}' | jq -r .token)
curl -s -A curl "http://localhost:8081/api/v1/admin/gift-cards?status=LOST" -H "Authorization: Bearer $TOKEN"
```

## Expected
`400` with the `ErrorDto` documented in the OpenAPI description of the endpoint
("400 Unknown status", schema `ErrorDto`), i.e. a body `{"message": "..."}` naming the rejected value,
without internal class names.

## Actual
`400` with a body that is not an `ErrorDto` and leaks the fully qualified Java enum name:
```json
{ "error" : "No enum constant com.awesome.testing.dto.giftcard.GiftCardStatus.LOST" }
```
The same global handler answers other enum query parameters (for example `GET /api/v1/orders?status=FOO`)
the same way, so the fix belongs in the shared type-mismatch handling.

## Evidence
- `tests/api/gift-cards/admin-gift-cards.api.spec.ts` — "an unknown status is answered with the documented ErrorDto - 400" (fixme)
- `AdminGiftCardController#list` declares `@ApiResponse(responseCode = "400", description = "Unknown status", schema = ErrorDto)`.
