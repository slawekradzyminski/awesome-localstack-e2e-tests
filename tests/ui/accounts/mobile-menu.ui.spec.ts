import { test, expect } from '@fixtures';
import { MobileMenu } from '@pages/components/mobile-menu.component';
import { expectReachable } from '@support/layout';

test.describe('mobile menu', { tag: ['@accounts'] }, () => {
  test('Logout lines up with the other items and stays reachable on a short phone screen (T-060)', async ({ adminPage }) => {
    // given: the admin sees the longest menu (Warehouse and Admin links)
    await adminPage.setViewportSize({ width: 390, height: 560 });
    await adminPage.goto('/');
    const menu = new MobileMenu(adminPage);

    // when
    await menu.open();

    // then
    expect(await menu.labelStart(menu.logout)).toBe(await menu.labelStart(menu.cart));
    expect(await menu.labelStart(menu.profile)).toBe(await menu.labelStart(menu.cart));
    await expectReachable(menu.logout);
  });
});
