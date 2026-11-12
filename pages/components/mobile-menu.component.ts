import type { Locator, Page } from '@playwright/test';

/** The header's menu on screens narrower than xl. */
export class MobileMenu {
  readonly toggle: Locator;
  readonly root: Locator;
  readonly cart: Locator;
  readonly logout: Locator;
  readonly profile: Locator;

  constructor(page: Page) {
    this.toggle = page.getByTestId('mobile-menu-toggle');
    this.root = page.getByTestId('mobile-menu');
    this.cart = page.getByTestId('mobile-menu-cart');
    this.logout = page.getByTestId('mobile-menu-logout');
    this.profile = page.getByTestId('mobile-menu-username');
  }

  async open(): Promise<void> {
    await this.toggle.click();
    await this.root.waitFor();
  }

  /** Left edge of the item's label text, to compare alignment between items. */
  labelStart(item: Locator): Promise<number> {
    return item.evaluate((element) => {
      const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => (node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
      });
      const range = document.createRange();
      range.selectNodeContents(walker.nextNode()!);
      return Math.round(range.getBoundingClientRect().left);
    });
  }
}
