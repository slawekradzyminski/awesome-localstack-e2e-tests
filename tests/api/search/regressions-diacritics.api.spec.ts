import { test, expect } from '@fixtures';
import { createSearchProduct, names, searchProducts, searchToken } from '@support/search';

// T-027: product search ignores Polish (and other Latin) diacritics on both sides.
test.describe('GET /api/v1/products/search - diacritics', { tag: ['@search'] }, () => {
  const queries: [string, string][] = [
    ['plain letters find accented names', 'zazolc'],
    ['accented upper-case letters find the same product', 'ZAŻÓŁĆ'],
    ['a plain phrase finds an accented phrase', 'gesla jazn'],
  ];
  for (const [name, query] of queries) {
    test(`${name} - 200`, async ({ api, shopper }) => {
      // given
      const token = searchToken();
      const pangram = await createSearchProduct(api, { name: `Zażółć gęślą jaźń ${token}`, category: `${token}-books` });
      await createSearchProduct(api, { name: `Plain ${token}`, category: `${token}-books` });

      // when
      const result = await searchProducts(shopper.search, { q: query, category: [`${token}-books`] });

      // then
      expect(names(result)).toEqual([pangram.name]);
    });
  }
});
