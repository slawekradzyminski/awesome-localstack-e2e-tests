import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';
import type { LoginDto } from '@models/auth';

/** /login: username and password sign-in. */
export class LoginPage extends BasePage {
  readonly username: Locator;
  readonly password: Locator;
  readonly submit: Locator;

  constructor(page: Page) {
    super(page);
    this.username = page.getByTestId('login-username-input');
    this.password = page.getByTestId('login-password-input');
    this.submit = page.getByTestId('login-submit-button');
  }

  async goto(): Promise<void> {
    await this.page.goto('/login');
    await this.username.waitFor();
  }

  async signIn(credentials: LoginDto): Promise<void> {
    await this.username.fill(credentials.username);
    await this.password.fill(credentials.password);
    await this.submit.click();
  }
}
