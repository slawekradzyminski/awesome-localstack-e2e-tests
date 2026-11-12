# Commerce e2e contributor guide

Playwright API, UI and cross-service journey tests for the awesome-localstack commerce
features (payments, gift cards, loyalty, VAT and currencies, search, tracking, webhooks).
They run against a running stack, `http://localhost:8081` unless `APP_BASE_URL` says otherwise.

## Layout

```
api/          one typed client per endpoint group (payments.client.ts, ...), no assertions
models/       DTO types of request and response bodies (PageDto<T> lives in page.ts)
fixtures/     api.fixtures.ts, ui.fixtures.ts, index.ts: the only import specs need
pages/        page objects by app area: shop/, account/, admin/, warehouse/, components/
support/      actors (Shopper, Admin, Warehouse, Parcels), domain helpers, expect, step, network
tests/setup/  stack-health project, a dependency of every other project
tests/api/    one folder per feature, one spec per endpoint group
tests/ui/     one folder per feature, data prepared through the API
tests/journeys/ stories that follow an order through every service
bugs/         one report per known defect; tests for open bugs are test.fixme
```

Imports use the tsconfig aliases `@api/*`, `@models/*`, `@pages/*`, `@support/*`,
`@fixtures` and `@config`; only files in the same folder import each other with `./`.

## Conventions

- **Structure.** Every test has `// given`, `// when` and `// then` sections. It reads top to
  bottom: no `if`, no loops over results, no conditional `expect` (ESLint enforces it).
  Parametrise with a `for` loop around `test()` instead.
- **Data ownership.** A test creates the users, products, orders, gift cards and webhooks it
  uses through fixtures and helpers, and never edits seeded data (PL/DE/FR/US VAT, USD/EUR/
  PLN/GBP/CHF). The `api` fixture deletes the users and products it created; `parcels`
  delivers every simulated parcel it shipped. Shared lists (admin payments, gift cards) are
  searched for the test's own rows, never counted.
- **VAT rates and currencies cannot be deleted.** Use `countryWithVat` and `currencyWithRate`
  from `@support/tax`: they upsert a test-owned code from a fixed pool chosen by the worker's
  `parallelIndex`, so runs never use up new codes. `unusedCountryCode`/`unusedCurrencyCode`
  are only for tests that must see a 404 or must assert a 201 create. Two concurrent runs
  against one stack share the pool.
- **No sleeps.** Wait for state: web-first assertions, `expect.poll` with `ASYNC_TIMEOUT` and
  `POLL_INTERVALS` from `@config`, or the `waitFor*` helpers. `waitForTimeout` is a lint error.
- **Statuses.** `await expect(response, 'what the call does').toHaveStatus(201)`, from the
  shared `expect` (`@fixtures` in specs, `@support/expect` elsewhere). It accepts browser
  responses and a list (`[204, 404]`) and prints the URL and body on failure.
- **Tags.** Every top-level `describe` has `{ tag: [...] }` with its feature: `@payments`,
  `@gift-cards`, `@loyalty`, `@tax`, `@currencies`, `@search`, `@tracking`, `@webhooks`,
  `@accounts`, `@catalog`, `@orders`, `@cart`, `@coupons`, `@admin`, `@qr`, `@llm`,
  `@graphql`, `@security`, `@journey`, `@smoke`. Add `@slow` to a test that waits more than ~5 s on background work
  (delayed card settlement, event feed, retry back-off).
- **Steps.** Helper actions and waits carry `@step('title {0}')` from `@support/step`, which
  wraps them in a boxed `test.step`; plain reads stay undecorated so polling does not flood
  the report. Use `test.step` in a test only for a multi-call phase of a journey.
- **Page objects.** Locators are `readonly` fields built in the constructor, preferably
  `getByTestId`/`getByRole`; per-row locators are methods (`row(code)`). Actions are
  intent-named methods (`cardForm.payWith(card)`, `giftCard.apply(code)`). A page object
  asserts only in methods named `expect*`; `goto()` synchronises with `locator.waitFor()`.
  Every routed page extends `BasePage`. A page object used by several specs is a fixture in
  `fixtures/ui.fixtures.ts`, bound to the page of the role that uses it.
- **Bugs.** A failing behaviour that is a product defect gets a report in `bugs/` and the
  test stays, marked `test.fixme(true, 'bugs/<file>.md')` as its first line. Do not weaken
  the assertion to make it pass; remove the fixme when the bug is fixed.

## Verification

```bash
npm run check                                  # typecheck + ESLint, zero warnings
npx playwright test --workers=3                # everything (stack-health runs first)
npx playwright test --project=ui --repeat-each=2
npm run test:fast                              # skips @slow
npm run test:payments                          # one feature (see package.json)
```

On a loaded laptop, lower `--workers` before suspecting a change; a test that fails only under load is
worth a bug report (that is how the connection-pool bugs in `bugs/` were found).
