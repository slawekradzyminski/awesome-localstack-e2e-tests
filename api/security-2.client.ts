import type { APIRequestContext } from '@playwright/test';

/** Endpoints behind the backend 3.20.0 security fixes (exploration X-05, X-08, X-12, X-23). */
export class SecurityTwoClient {
  constructor(private readonly request: APIRequestContext) {}

  private static bearer(token: string): Record<string, string> {
    return { Authorization: `Bearer ${token}` };
  }

  me(token: string) {
    return this.request.get('/api/v1/users/me', { headers: SecurityTwoClient.bearer(token) });
  }

  logout(token: string) {
    return this.request.post('/api/v1/users/logout', { headers: SecurityTwoClient.bearer(token) });
  }

  refresh(refreshToken: string) {
    return this.request.post('/api/v1/users/refresh', { data: { refreshToken } });
  }

  forgotPassword(identifier: string) {
    return this.request.post('/api/v1/users/password/forgot', { data: { identifier } });
  }

  resetPassword(token: string, newPassword: string) {
    return this.request.post('/api/v1/users/password/reset', {
      data: { token, newPassword, confirmPassword: newPassword },
    });
  }

  users(token: string) {
    return this.request.get('/api/v1/users', { headers: SecurityTwoClient.bearer(token) });
  }

  user(username: string, token: string) {
    return this.request.get(`/api/v1/users/${encodeURIComponent(username)}`, { headers: SecurityTwoClient.bearer(token) });
  }

  sendEmail(email: Record<string, unknown>, token: string) {
    return this.request.post('/api/v1/email', { data: email, headers: SecurityTwoClient.bearer(token) });
  }

  createProduct(product: Record<string, unknown>, token: string) {
    return this.request.post('/api/v1/products', { data: product, headers: SecurityTwoClient.bearer(token) });
  }
}
