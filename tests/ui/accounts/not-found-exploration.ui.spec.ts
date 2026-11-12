import { test, expect } from '@fixtures';
import { HomePage } from '@pages/account/home.page';
import { NotFoundPage } from '@pages/components/not-found.page';

// X-32: an unknown SPA path rendered the header and footer around an empty <main>.
test.describe('unknown routes', { tag: ['@accounts'] }, () => {
  test('an anonymous visitor gets a not-found page with a way back (X-32)', async ({ page }) => {
    // given
    const notFound = new NotFoundPage(page);

    // when
    await notFound.goto('/this-page-does-not-exist');

    // then
    await expect(page).toHaveTitle('Page not found – Awesome Testing');
    await expect(page.getByTestId('not-found-message')).toContainText('/this-page-does-not-exist');

    // when
    await notFound.homeLink.click();

    // then: the home page needs a session
    await expect(page).toHaveURL(/\/login$/);
  });

  test('a signed-in user gets the not-found page and its link goes home (X-32)', async ({ shopperPage }) => {
    // given
    const notFound = new NotFoundPage(shopperPage);
    await notFound.goto('/orders/7/receipt');

    // when
    await notFound.homeLink.click();

    // then
    await expect(new HomePage(shopperPage).welcome).toBeVisible();
  });
});
