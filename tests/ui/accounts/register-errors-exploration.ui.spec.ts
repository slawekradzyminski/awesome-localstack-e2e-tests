import { test, expect } from '@fixtures';
import { RegisterPage } from '@pages/account/register.page';
import { generateUser } from '@support/generators/user.generator';
import { recordRequests } from '@support/network';

// X-14: a whitespace-only username passed the client checks and the backend's field message ended up
// as a generic 'Failed to register'. Since frontend 3.14.0 names are trimmed and checked on the client,
// and a 400 field map from the server is shown under the matching field.
test.describe('sign-up field errors', { tag: ['@accounts'] }, () => {
  test('a whitespace-only username is rejected before any request (X-14)', async ({ page }) => {
    // given
    const signups = recordRequests(page, (request) => request.url().endsWith('/api/v1/users/signup'));
    const register = new RegisterPage(page);
    await register.goto();
    await register.fill({ ...generateUser(), username: '     ' });

    // when
    await page.getByTestId('register-submit-button').click();

    // then
    await expect(page.getByTestId('register-username-error')).toHaveText('Username is required');
    expect(signups).toEqual([]);
  });

  test("the server's field message is shown under its field, not as 'Failed to register' (X-14)", async ({ page }) => {
    // given: the request reaches the real backend with a username it rejects
    const user = generateUser();
    await page.route('**/api/v1/users/signup', (route) => route.continue({
      postData: JSON.stringify({ ...route.request().postDataJSON(), username: 'abc' }),
    }));
    const register = new RegisterPage(page);
    await register.goto();
    await register.fill(user);

    // when
    const response = page.waitForResponse((candidate) => candidate.url().endsWith('/api/v1/users/signup'));
    await page.getByTestId('register-submit-button').click();

    // then
    await expect(await response, 'Sign-up with a 3-character username').toHaveStatus(400);
    await expect(page.getByTestId('register-username-error')).toHaveText('Minimum username length: 4 characters');
    await expect(register.username).toHaveAttribute('aria-invalid', 'true');
    await expect(page.getByTestId('register-submit-error')).toHaveCount(0);
    await expect(page).toHaveURL(/\/register$/);
  });
});
