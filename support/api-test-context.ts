import { expect } from './expect';
import { type APIRequestContext } from '@playwright/test';
import { generateProduct } from '@support/generators/product.generator';
import { generateUser } from '@support/generators/user.generator';
import { AuthClient } from '@api/auth.client';
import { ProductsClient } from '@api/products.client';
import { UsersClient } from '@api/users.client';
import { ADMIN_PASSWORD, ADMIN_USERNAME, WAREHOUSE_PASSWORD, WAREHOUSE_USERNAME } from '@config';
import type { ProductCreateDto, ProductDto } from '@models/product';
import type { UserRegisterDto } from '@models/user';

export interface TestUser {
  user: UserRegisterDto;
  token: string;
}

// Owns the users and products a test creates and removes them afterwards.
export class ApiTestContext {
  private readonly usernames = new Set<string>();
  private readonly productIds = new Set<number>();
  private adminToken?: Promise<string>;
  private warehouseToken?: Promise<string>;

  constructor(readonly request: APIRequestContext) {}

  async login(username: string, password: string): Promise<string> {
    const response = await new AuthClient(this.request).login({ username, password });
    await expect(response, `Login of ${username}`).toHaveStatus(200);
    const { token } = await response.json();
    expect(token).toEqual(expect.stringMatching(/\S+/));
    return token;
  }

  getAdminToken(): Promise<string> {
    return this.adminToken ??= this.login(ADMIN_USERNAME, ADMIN_PASSWORD);
  }

  getWarehouseToken(): Promise<string> {
    return this.warehouseToken ??= this.login(WAREHOUSE_USERNAME, WAREHOUSE_PASSWORD);
  }

  async adminProducts(): Promise<ProductsClient> {
    return new ProductsClient(this.request, await this.getAdminToken());
  }

  async registerUser(user: UserRegisterDto) {
    const response = await new UsersClient(this.request).register(user);
    if (response.status() === 201) this.trackUser(user.username);
    return response;
  }

  // Register ownership after a confirmed UI signup so the same cleanup applies.
  trackUser(username: string): void {
    this.usernames.add(username);
  }

  async createUser(): Promise<TestUser> {
    const user = generateUser();
    const response = await this.registerUser(user);
    await expect(response, 'Registration of a test user').toHaveStatus(201);
    return { user, token: await this.login(user.username, user.password) };
  }

  trackProduct(product: Pick<ProductDto, 'id'>): void {
    this.productIds.add(Number(product.id));
  }

  async createProduct(overrides: Partial<ProductCreateDto> = {}): Promise<ProductDto> {
    const response = await (await this.adminProducts()).create({ ...generateProduct(), ...overrides });
    await expect(response, 'Creation of a test product').toHaveStatus(201);
    const created: ProductDto = await response.json();
    this.trackProduct(created);
    return created;
  }

  async cleanup(): Promise<void> {
    if (this.usernames.size === 0 && this.productIds.size === 0) return;
    const adminToken = await this.getAdminToken();
    const errors: unknown[] = [];
    // Users first: deleting a user removes their cart and order references to products.
    for (const username of this.usernames) {
      try {
        const response = await new UsersClient(this.request).delete(username, adminToken);
        await expect(response, `Cleanup of user ${username}`).toHaveStatus(204);
        this.usernames.delete(username);
      } catch (error) {
        errors.push(error);
      }
    }
    const products = new ProductsClient(this.request, adminToken);
    for (const id of this.productIds) {
      try {
        const response = await products.delete(id);
        await expect(response, `Cleanup of product ${id}`).toHaveStatus([204, 404]);
        this.productIds.delete(id);
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length) throw new AggregateError(errors, 'Test resource cleanup failed');
  }
}
