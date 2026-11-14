# awesome-localstack e2e tests

The reference Playwright suite for [awesome-localstack](https://github.com/slawekradzyminski/awesome-localstack).
It tests the application end to end through the public gateway: the API, the browser, and
journeys that follow one order across every service. The commerce features are covered in
depth, and the regression tests for every defect fixed in the older features are included too.

| Feature | Services involved |
| --- | --- |
| Card payments, 3-D Secure, idempotency | payment-service → signed result → backend |
| Gift cards and loyalty points | backend (tenders, refund split) |
| VAT and currencies | backend |
| Product search and facets | backend |
| Shipment tracking (simulated carrier) | warehouse-service → backend mirror |
| Split shipments from the Krakow and Gdansk locations | warehouse-service (allocation, reallocate, short pick) → backend mirror |
| Stock reservations that expire | backend → event feed → payment-service (void) and notification-service |
| User webhooks with HMAC signatures | backend event feed → notification-service → built-in inbox |
| Commerce emails (My notifications) | backend `notification.requested` → notification-service |
| Refunds and cancellations | backend event feed → payment-service and warehouse-service |
| Accounts, identity and validation | backend |
| Catalog, cart, coupons, orders, admin screens | backend + frontend |
| QR codes and LLM chat | backend + frontend + ollama-mock |

**820 tests**: 596 API, 219 UI and 5 journeys, plus 5 stack-health checks. They run in
about 4 minutes with 4 workers against a laptop stack (about 600 MB of RAM for the whole
lightweight profile).

## Run it

1. Start the lightweight profile of awesome-localstack:

   ```bash
   git clone https://github.com/slawekradzyminski/awesome-localstack
   cd awesome-localstack
   docker compose -f lightweight-docker-compose.yml up -d --wait
   ```

2. Install and run (Node.js 24):

   ```bash
   npm ci
   npx playwright install chromium
   npx playwright test
   ```

Useful variants:

```bash
npm run test:api              # one project: api, ui or journeys
npm run test:payments         # one feature (see package.json for the others)
npm run test:fast             # everything except @slow
npx playwright test --ui      # pick and watch tests interactively
npm run report                # last HTML report
```

`APP_BASE_URL` (default `http://localhost:8081`) and the demo credentials can be changed
in a `.env` file; see `.env.example`. The suite creates and deletes its own users, products,
orders, gift cards and webhooks, and uses the demo `admin` and `warehouse` accounts. Point
it at your laptop or a CI stack, never at the public hosts.

## How it is built

```
api/          typed HTTP clients, one per endpoint group (no assertions)
models/       request and response types
fixtures/     test, expect and every fixture: `import { test, expect } from '@fixtures'`
pages/        page objects by app area: shop/, account/, admin/, warehouse/, components/
support/      actors (Shopper, Admin, Warehouse, Parcels), domain helpers, custom matchers
tests/setup/  stack-health: fails fast with one clear message when the stack is down
tests/api/    one folder per feature, one spec per endpoint group
tests/ui/     one folder per feature
tests/journeys/  stories across all services
bugs/         reports of product bugs the suite found
```

Patterns worth copying:

- **Every test owns its data.** The `shopper` fixture registers a fresh customer, and
  `api.createProduct` creates products. Both are removed after the test, so everything
  runs fully parallel.
- **Actors instead of raw calls.** `shopper.placeOrder()`, `shopper.payAndWaitForPaid()`,
  `warehouse.shipSimulated()` and `admin.issueGiftCard()` keep tests at the level of
  the business story. Each actor method is a boxed `test.step`, so reports read like that story too.
- **Wait for the system, never for the clock.** Card settlement, the event feed and webhook
  deliveries are awaited with `expect.poll` and one `ASYNC_TIMEOUT`. `waitForTimeout` is a
  lint error. The simulated carrier is fast-forwarded through its `advance` endpoint.
- **Test cards choose the outcome.** `TEST_CARDS.declined`, `.threeDs`, `.asyncTimeout`
  and the others reach every branch of the payment state machine on purpose.
- **Verify webhooks like a receiver.** `InboxReceiver` subscribes the backend's built-in
  inbox, and `isSignedWith` recomputes `HMAC-SHA256(secret, t + "." + body)`.
- **Follow a request across services.** A journey sends its own `X-Request-Id` and finds
  it again on the webhook delivery that the cancellation caused two services later.
- **Readable failures.** `await expect(response).toHaveStatus(201)` prints the URL and
  response body, not just two numbers.
- **Guardrails in tooling.** Strict TypeScript, typed ESLint with `eslint-plugin-playwright`
  (`no-floating-promises` catches a missing `await`), feature tags on every describe, and
  a `stack-health` setup project.

[AGENTS.md](AGENTS.md) holds the full conventions for contributors and coding agents.

## Bugs found

The suite found 12 defects in four services: 11 on its first full run and one on its first CI run. Each one has a report in
[`bugs/`](bugs/), and all of them are fixed: backend 3.17.1, payment-service 1.2.1,
warehouse-service 1.4.1 and frontend 3.12.2. The tests that caught them now guard against
regressions. A bug found later gets a report, and its test stays marked
`test.fixme(true, 'bugs/<file>.md')` until the fix is pinned. Highlights:

- **Connection-pool starvation in payment-service and warehouse-service.** Three concurrent
  first payments deadlocked a pool of three connections, and every caller got a 500 after 30 s.
- **Event-feed retention job never deleted anything.** A transactional self-call failed on every scheduled run.
- **Deleting a user raced with email events** and failed with a foreign-key violation.
- **A gift card expiry shifted by the admin's time zone.**
- **Admin lists that never showed a row saved during their first load.**
- **A placed order could land on the empty cart instead of its payment page** on a slow device.
  A CPU-throttled test (`Emulation.setCPUThrottlingRate`) now reproduces it deterministically.

Course groups found more defects in the older features (sign-up and sign-in validation,
accessibility, layout, QR, LLM chat): 186 reports, which collapse to 82 unique defects. The 48
that still reproduced are fixed in backend 3.18.0, frontend 3.13.0 and ollama-mock 1.0.12. Their
regression tests live in the `@accounts`, `@catalog`, `@orders`, `@cart`, `@coupons`,
`@admin`, `@qr`, `@llm` and `@graphql` folders. The bugs documented in the AI Testers API
course are deliberately left in the application, and so is any behaviour the course's l20
suite asserts.

## CI

`.github/workflows/commerce-e2e.yml` checks out awesome-localstack, starts the lightweight
profile with the pinned images and runs typecheck, lint and all projects. The HTML report
and traces are uploaded as an artifact. To test a new image pin before it reaches `main`,
run the workflow by hand with `localstack_ref`.
