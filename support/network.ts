import type { Page, Request } from '@playwright/test';

/** Collects "METHOD url" of every request the page sends from now on that matches `filter`. */
export function recordRequests(page: Page, filter: (request: Request) => boolean): string[] {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (filter(request)) requests.push(`${request.method()} ${request.url()}`);
  });
  return requests;
}

/** Every PUT/POST to the API from now on, to prove that client-side validation stopped a save. */
export function recordWrites(page: Page): string[] {
  return recordRequests(page, (request) => ['PUT', 'POST'].includes(request.method()) && request.url().includes('/api/'));
}

/**
 * Fetches matching GETs from the server at once but delivers them to the page only on release(),
 * so the page works with data that predates whatever the test does meanwhile.
 */
export function holdResponses(page: Page, url: string): { release: () => void } {
  let release!: () => void;
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  let isReleased = false;
  void released.then(() => {
    isReleased = true;
  });
  void page.route(url, async (route) => {
    if (isReleased || route.request().method() !== 'GET') return route.continue();
    const response = await route.fetch();
    await released;
    await route.fulfill({ response });
  });
  return { release };
}
