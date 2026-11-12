# BUG-GIFTCARDS-04: Applying a blank gift card code returns a randomly chosen validation message

## Environment
- Local awesome-localstack (`http://localhost:8081`), backend 3.17.0
- Endpoint: `PUT /api/v1/cart/gift-card` (any signed-in user with a non-empty cart)

## Steps
```bash
B=http://localhost:8081
# sign up / sign in a client, put any product in the cart, then repeat:
for i in $(seq 1 10); do
  curl -s -A curl -X PUT $B/api/v1/cart/gift-card -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' -d '{"code":""}'; echo
done
```

## Expected
The same input always produces the same `400` body, e.g. `{"code": "Gift card code is required"}`.

## Actual
`ApplyGiftCardDto.code` carries both `@NotBlank` ("Gift card code is required") and `@Size(min = 1, max = 32)`
("Gift card code must be 1-32 characters"). An empty string violates both and the error map keeps one of them in
an unspecified order, so repeated identical requests alternate between
`{"code": "Gift card code is required"}` and `{"code": "Gift card code must be 1-32 characters"}`
(3 of 10 runs returned the second message in one sample). Clients and tests cannot rely on the message.

## Evidence
- `tests/api/gift-cards/cart-gift-card.api.spec.ts` — "a blank code always gets the same validation message - 400" (fixme);
  "a blank code is rejected - 400" accepts either message until this is fixed.
