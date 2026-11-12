import { test, expect } from '@fixtures';
import { EmailPage } from '@pages/account/email.page';
import { HomePage } from '@pages/account/home.page';
import { UsersPage } from '@pages/admin/users.page';
import { recordRequests } from '@support/network';

// X-12: every account's name and email sat behind a client-reachable 'ADMIN · Users' page, a home
// card and the Send Email recipient picker (GET /api/v1/users). Since frontend 3.14.0 they are admin-only.
const userListRequest = (url: string) => new URL(url).pathname === '/api/v1/users';

test.describe('user directory is admin-only in the UI', { tag: ['@accounts', '@security'] }, () => {
  test('a client sees no Users card and is sent home from /users (X-12)', async ({ shopperPage }) => {
    // given
    const home = new HomePage(shopperPage);
    const directoryReads = recordRequests(shopperPage, (request) => userListRequest(request.url()));

    // when
    await home.goto();

    // then
    await expect(home.usersCard).toHaveCount(0);

    // when
    await shopperPage.goto('/users');

    // then
    await expect(shopperPage).toHaveURL(/\/$/);
    await expect(home.welcome).toBeVisible();
    await expect(shopperPage.getByTestId('users-list')).toHaveCount(0);
    expect(directoryReads).toEqual([]);
  });

  test('the Send Email form of a client does not load the user directory (X-12)', async ({ shopperPage }) => {
    // given
    const directoryReads = recordRequests(shopperPage, (request) => userListRequest(request.url()));
    const email = new EmailPage(shopperPage);

    // when
    await email.goto();

    // then
    await expect(email.to).toBeEditable();
    await expect(email.recipientPicker).toHaveCount(0);
    expect(directoryReads).toEqual([]);
  });

  test('an admin still opens the directory from home and gets the recipient picker (X-12)', async ({ adminPage, shopper }) => {
    // given
    const home = new HomePage(adminPage);
    const users = new UsersPage(adminPage);
    await home.goto();

    // when
    await home.usersCard.click();

    // then
    await expect(adminPage).toHaveURL(/\/users$/);
    await expect(users.row(shopper.username)).toContainText(shopper.user.email);

    // when
    await new EmailPage(adminPage).goto();

    // then
    await expect(adminPage.getByTestId('users-datalist').locator(`option[value="${shopper.user.email}"]`)).toHaveCount(1);
  });
});
