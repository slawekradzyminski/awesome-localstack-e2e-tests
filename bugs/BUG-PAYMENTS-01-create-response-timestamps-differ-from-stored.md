# BUG-PAYMENTS-01: POST /api/v1/payments answers with timestamps that differ from the stored payment

Severity: low (data consistency of the public API; no money impact).

## Environment
- Local awesome-localstack (`http://localhost:8081`), payment-service 1.2.0 behind the gateway
- Endpoints: `POST /api/v1/payments` (201 and the idempotent 200 replay), `GET /api/v1/payments/{id}`,
  `GET /api/v1/orders/{orderId}/payments`, `GET /api/v1/admin/payments`

## Steps
```bash
B=http://localhost:8081
# a customer token $T and a PENDING order $O of that customer
K=pw-$(uuidgen)
BODY="{\"orderId\":$O,\"card\":{\"number\":\"4242424242424242\",\"expiryMonth\":12,\"expiryYear\":2030,\"cvc\":\"123\",\"holderName\":\"T C\"}}"
curl -s -A curl -H 'Content-Type: application/json' -H "Authorization: Bearer $T" -H "Idempotency-Key: $K" -d "$BODY" $B/api/v1/payments   # 201
curl -s -A curl -H 'Content-Type: application/json' -H "Authorization: Bearer $T" -H "Idempotency-Key: $K" -d "$BODY" $B/api/v1/payments   # 200 replay
curl -s -A curl -H "Authorization: Bearer $T" $B/api/v1/orders/$O/payments
```

## Expected
The contract (`docs/PAYMENT_SERVICE_CONTRACT.md`): "replaying the same key with the same body returns 200 with
the original payment". The 201 answer, the replay and every later read describe the same stored payment, so
`createdAt` and `updatedAt` are identical everywhere.

## Actual
The 201 answer carries the in-memory nanosecond timestamps, while PostgreSQL stores (and every read, including the
idempotent replay, returns) the value rounded to microseconds:

```text
201 POST      createdAt 2026-11-12T07:58:13.987074842
200 replay    createdAt 2026-11-12T07:58:13.987075
GET list      createdAt 2026-11-12T07:58:13.987075
```

A client that keeps the 201 body and compares it with a later read (or with the replay it receives after a lost
response) sees a different payment timestamp, and the value in the 201 answer was never stored. Likely fix: truncate
the clock to microseconds when the payment is created (or re-read the saved entity before mapping the response).

## Evidence
- `tests/api/payments/idempotency.api.spec.ts` — "replays the original payment with identical timestamps - 200" (fixme)
- The other payments specs compare timestamps with `expectSamePayment` (support/payments.ts), which tolerates the
  microsecond rounding so they keep guarding the rest of the payment.
