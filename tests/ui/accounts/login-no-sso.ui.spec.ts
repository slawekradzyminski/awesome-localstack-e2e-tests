import { test, expect } from '@fixtures';

// The training stack has no identity provider any more (Keycloak was removed), so the login
// page offers username and password only, and the former SSO callback route is gone.
test.describe('login without single sign-on', { tag: ['@accounts'] }, () => {
  test('offers only username and password sign-in', async ({ page }) => {
    // given
    const loginForm = page.getByTestId('login-form');

    // when
    await page.goto('/login');

    // then
    await expect(loginForm).toBeVisible();
    await expect(loginForm.getByRole('textbox', { name: 'Username' })).toBeVisible();
    await expect(loginForm.getByLabel('Password')).toBeVisible();
    await expect(page.getByTestId('login-submit-button')).toBeVisible();
    await expect(page.getByTestId('login-sso-button')).toHaveCount(0);
    await expect(page.getByTestId('login-google-button')).toHaveCount(0);
    await expect(page.getByTestId('login-github-button')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /sso|google|github/i })).toHaveCount(0);
  });

  test('no longer serves the SSO callback page', async ({ page }) => {
    // given
    const appMain = page.getByTestId('app-main');

    // when
    await page.goto('/auth/sso/callback?code=unused&state=unused');

    // then
    await expect(appMain).toBeAttached();
    await expect(page.getByTestId('sso-callback-page')).toHaveCount(0);
    await expect(appMain).toBeEmpty();
  });
});
