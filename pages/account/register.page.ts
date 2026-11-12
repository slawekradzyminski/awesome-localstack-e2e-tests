import type { Locator, Page } from '@playwright/test';
import { BasePage } from '@pages/base.page';
import type { UserRegisterDto } from '@models/user';

/** /register: the sign-up form and the "Already have an account? Sign in" link below it. */
export class RegisterPage extends BasePage {
  readonly username: Locator;
  readonly email: Locator;
  readonly password: Locator;
  readonly firstName: Locator;
  readonly lastName: Locator;
  readonly signInLink: Locator;

  constructor(page: Page) {
    super(page);
    this.username = page.getByTestId('register-username-input');
    this.email = page.getByTestId('register-email-input');
    this.password = page.getByTestId('register-password-input');
    this.firstName = page.getByTestId('register-firstname-input');
    this.lastName = page.getByTestId('register-lastname-input');
    this.signInLink = page.getByTestId('register-login-link');
  }

  async goto(): Promise<void> {
    await this.page.goto('/register');
    await this.username.waitFor();
  }

  async fill(user: UserRegisterDto): Promise<void> {
    await this.username.fill(user.username);
    await this.email.fill(user.email);
    await this.password.fill(user.password);
    await this.firstName.fill(user.firstName);
    await this.lastName.fill(user.lastName);
  }
}
