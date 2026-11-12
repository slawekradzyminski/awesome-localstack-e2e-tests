import type { APIRequestContext } from '@playwright/test';

/**
 * Sends request bodies exactly as a test writes them: wrongly typed JSON, raw (malformed) text or another
 * content type. The typed clients cannot express those. Without a token the requests are anonymous.
 */
export class ValidationClient {
  constructor(private readonly request: APIRequestContext, private readonly token?: string) {}

  get(path: string) {
    return this.request.get(path, { headers: this.headers() });
  }

  post(path: string, body: unknown) {
    return this.request.post(path, { data: body, headers: this.headers({ 'Content-Type': 'application/json' }) });
  }

  put(path: string, body: unknown) {
    return this.request.put(path, { data: body, headers: this.headers({ 'Content-Type': 'application/json' }) });
  }

  /** The body is sent byte for byte; contentType defaults to JSON so malformed JSON reaches the parser. */
  postRaw(path: string, body: string, contentType = 'application/json') {
    return this.request.post(path, { data: body, headers: this.headers({ 'Content-Type': contentType }) });
  }

  putRaw(path: string, body: string) {
    return this.request.put(path, { data: body, headers: this.headers({ 'Content-Type': 'application/json' }) });
  }

  getAccepting(path: string, accept: string) {
    return this.request.get(path, { headers: this.headers({ Accept: accept }) });
  }

  private headers(extra: Record<string, string> = {}): Record<string, string> {
    return { ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...extra };
  }
}

export const SIGNUP = '/api/v1/users/signup';
export const SIGNIN = '/api/v1/users/signin';
export const PASSWORD_FORGOT = '/api/v1/users/password/forgot';
export const PASSWORD_RESET = '/api/v1/users/password/reset';
export const IDENTITY_ISSUES = '/api/v1/admin/users/identity-issues';
export const userPath = (username: string) => `/api/v1/users/${encodeURIComponent(username)}`;
export const productPath = (id: number | string) => `/api/v1/products/${encodeURIComponent(id)}`;
