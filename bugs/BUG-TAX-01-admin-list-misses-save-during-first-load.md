# BUG-TAX-01: Admin VAT rates and currencies lists miss a row saved while the first list load is in flight

Severity: low (stale UI, data is saved correctly; a reload shows the row).

## Environment
- awesome-localstack `awesome-light` at http://localhost:8081: frontend 3.12.0, backend 3.17.0
- Chromium (Playwright Desktop Chrome), signed in as the demo admin

## Steps
1. Open `/admin/vat-rates` (or `/admin/currencies`) on a slow connection, so `GET /api/v1/vat-rates`
   (`GET /api/v1/currencies`) is still loading.
2. Before the list appears, fill the "Add or replace a country" form (e.g. code `XU`, name `Raced Land`, rate `9`) and press Save.
3. `PUT /api/v1/admin/vat-rates/XU` answers 201 and the form resets.
4. The first list response (sent before the PUT) arrives.

Reproduced deterministically in `tests/ui/tax/admin-vat-rates.ui.spec.ts` and `tests/ui/tax/admin-currencies.ui.spec.ts`
("... saved before the first list response arrived"): the list GET is fetched from the server immediately but delivered to
the page only after the PUT has completed.

## Expected
After a successful save the list shows the new row (`admin-vat-row-XU` with `9%`), as it does when the list had already loaded.

## Actual
The list renders the older response without the new row and never refetches; only a reload shows it.

## Evidence / cause
`AdminVatRates`/`AdminCurrencies` call `queryClient.invalidateQueries({ queryKey })` after the save. In TanStack Query v5,
a refetch of a query that has no data yet and a fetch in flight is deduplicated onto that in-flight fetch
(`cancelRefetch` only cancels when data exists), so the invalidation resolves with the pre-save response.
Trace of the failing run: `GET /api/v1/vat-rates` started 07:57:58.196, `PUT /api/v1/admin/vat-rates/XU` 201 at 07:57:58.288,
no further GET.

Possible fixes: disable the forms until the list has loaded, or `await queryClient.cancelQueries({ queryKey })` before
`invalidateQueries`, or update the cache from the PUT response (`setQueryData`).
