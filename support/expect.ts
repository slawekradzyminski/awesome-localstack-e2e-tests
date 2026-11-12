import { expect as baseExpect, type APIResponse, type Response } from '@playwright/test';

/** An API response (request fixture) or a browser response (page.waitForResponse). */
type HttpResponse = Pick<APIResponse | Response, 'status' | 'url' | 'text'>;

/**
 * The shared `expect`, with one extra matcher:
 *
 *   await expect(response, 'Create a payment').toHaveStatus(201);
 *   await expect(response).toHaveStatus([204, 404]);
 *
 * A failure prints the URL and the start of the body instead of only "expected 201, received 400".
 */
export const expect = baseExpect.extend({
  async toHaveStatus(response: HttpResponse, expected: number | number[]) {
    const assertionName = 'toHaveStatus';
    const allowed = Array.isArray(expected) ? expected : [expected];
    const actual = response.status();
    const pass = allowed.includes(actual);
    const body = pass === this.isNot ? await bodyOf(response) : '';
    const hint = this.utils.matcherHint(assertionName, undefined, undefined, { isNot: this.isNot });
    const wanted = allowed.length === 1 ? allowed[0] : allowed;
    return {
      name: assertionName,
      pass,
      expected,
      actual,
      message: () => `${hint}\n\n`
        + `Expected status: ${this.isNot ? 'not ' : ''}${this.utils.printExpected(wanted)}\n`
        + `Received status: ${this.utils.printReceived(actual)}\n`
        + `URL: ${response.url()}\nBody: ${body}`,
    };
  },
});

async function bodyOf(response: HttpResponse): Promise<string> {
  try {
    return (await response.text()).slice(0, 2_000);
  } catch {
    return '<body unavailable>';
  }
}
