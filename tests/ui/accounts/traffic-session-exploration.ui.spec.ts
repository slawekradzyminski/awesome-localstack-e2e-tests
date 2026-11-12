import type { Page } from '@playwright/test';
import { test, expect } from '@fixtures';
import { TrafficClient } from '@api/traffic.client';
import type { TrafficLogEntryDto } from '@models/traffic';
import type { PageDto } from '@models/page';
import { HomePage } from '@pages/account/home.page';
import { LoginPage } from '@pages/account/login.page';

// X-03 (frontend part): the X-Client-Session-Id was created once per browser and kept forever, so the
// next person signing in on the same browser read the previous user's recorded requests (sign-in bodies
// included) in the traffic monitor. Since frontend 3.14.0 a sign-in and every sign-out start a new session.
test.describe('traffic session per sign-in', { tag: ['@accounts', '@security'] }, () => {
  test('logout and the next sign-in each start a new traffic session; the next user cannot read the previous one (X-03)', async ({ page, api, shopper, otherShopper }) => {
    // given: the first user signs in and browses
    const login = new LoginPage(page);
    const home = new HomePage(page);
    await login.goto();
    await login.signIn({ username: shopper.username, password: shopper.user.password });
    await expect(home.welcome).toBeVisible();
    const firstUserSession = await clientSessionId(page);

    // when
    await home.logoutButton.click();

    // then
    await expect(page).toHaveURL(/\/login$/);
    const afterLogout = await clientSessionId(page);
    expect(afterLogout).not.toBe(firstUserSession);

    // when: the next person signs in on the same browser
    const signIn = page.waitForRequest((request) => request.url().endsWith('/api/v1/users/signin'));
    await login.signIn({ username: otherShopper.username, password: otherShopper.user.password });
    await expect(home.welcome).toBeVisible();

    // then
    const nextUserSession = await clientSessionId(page);
    expect((await signIn).headers()['x-client-session-id']).toBe(nextUserSession);
    expect([firstUserSession, afterLogout]).not.toContain(nextUserSession);
    const logs = await new TrafficClient(api.request, otherShopper.token).logs(nextUserSession, { pathContains: '/api/v1/users' });
    await expect(logs, 'Traffic of the next user\'s session').toHaveStatus(200);
    const recorded = JSON.stringify(((await logs.json()) as PageDto<TrafficLogEntryDto>).content);
    expect(recorded).not.toContain(shopper.username);
  });
});

async function clientSessionId(page: Page): Promise<string> {
  const id = await page.evaluate(() => window.localStorage.getItem('clientSessionId') ?? '');
  expect(id).toMatch(/^[A-Za-z0-9_-]{16,128}$/);
  return id;
}
