import type { APIRequestContext } from '@playwright/test';

type RequestOptions = NonNullable<Parameters<APIRequestContext['fetch']>[1]>;
export type Query = Record<string, string | number | boolean | undefined | (string | number)[]>;

// Shared plumbing: bearer token, JSON bodies, optional extra headers (Idempotency-Key, X-Request-Id).
// Without a token a client sends anonymous requests, which the 401 tests rely on.
export abstract class ApiClient {
  constructor(protected readonly request: APIRequestContext, protected readonly token?: string) {}

  protected get(path: string, params?: Query, headers: Record<string, string> = {}) {
    const search = toSearchParams(params);
    return this.request.get(path, search ? { params: search, headers: this.headers(headers) } : { headers: this.headers(headers) });
  }

  protected post(path: string, data?: unknown, headers: Record<string, string> = {}) {
    return this.request.post(path, this.body(data, headers));
  }

  protected put(path: string, data?: unknown, headers: Record<string, string> = {}) {
    return this.request.put(path, this.body(data, headers));
  }

  protected delete(path: string, headers: Record<string, string> = {}) {
    return this.request.delete(path, { headers: this.headers(headers) });
  }

  private body(data: unknown, headers: Record<string, string>): RequestOptions {
    return data === undefined
      ? { headers: this.headers(headers) }
      : { data, headers: this.headers({ 'Content-Type': 'application/json', ...headers }) };
  }

  private headers(extra: Record<string, string>): Record<string, string> {
    return { ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}), ...extra };
  }
}

// Repeated keys (category=a&category=b) need URLSearchParams; Playwright's object form keeps one value per key.
function toSearchParams(params?: Query): URLSearchParams | undefined {
  if (!params) return undefined;
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    for (const item of Array.isArray(value) ? value : [value]) search.append(key, String(item));
  }
  return search;
}

export const segment = (value: string | number) => encodeURIComponent(String(value));
