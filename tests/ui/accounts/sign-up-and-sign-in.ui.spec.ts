import { test, expect } from '@fixtures';
import { AuthClient } from '@api/auth.client';
import { LoginPage } from '@pages/account/login.page';
import { RegisterPage } from '@pages/account/register.page';
import { generateUser } from '@support/generators/user.generator';
import { recordRequests } from '@support/network';

test.describe('sign-up and sign-in', { tag: ['@accounts'] }, () => {
  test("'Sign in' under a filled sign-up form only opens the login page (T-001)", async ({ page, api }) => {
    // given
    const user = generateUser();
    const signups = recordRequests(page, (request) => request.url().includes('/api/v1/users/signup'));
    const register = new RegisterPage(page);
    await register.goto();
    await register.fill(user);

    // when
    await register.signInLink.click();

    // then
    await expect(page).toHaveURL(/\/login$/);
    expect(signups).toEqual([]);
    await expect(await new AuthClient(api.request).login({ username: user.username, password: user.password }), 'Login of the never-registered user').toHaveStatus(422);
  });

  test('a sign-in loads the signed-in user once (T-067)', async ({ page, shopper }) => {
    // given
    const meRequests = recordRequests(page, (request) => request.url().endsWith('/api/v1/users/me'));
    const login = new LoginPage(page);
    await login.goto();

    // when
    await login.signIn({ username: shopper.username, password: shopper.user.password });

    // then
    await expect(page.getByTestId('home-page')).toBeVisible();
    await expect(page.getByTestId('username-profile-link')).toHaveText(`${shopper.user.firstName} ${shopper.user.lastName}`);
    // The page mounts after the route guard has the user; a second read would already be on its way.
    expect(meRequests).toHaveLength(1);
  });
});
