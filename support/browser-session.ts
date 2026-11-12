import { expect } from './expect';
import { randomUUID } from 'node:crypto';
import { type APIRequestContext, type BrowserContext } from '@playwright/test';
import { AuthClient } from '@api/auth.client';
import type { LoginDto, LoginResponseDto } from '@models/auth';

// Signs a browser context in through the API and seeds the frontend's localStorage,
// so UI tests start on the page under test instead of the login form.
export async function signInBrowser(
  context: BrowserContext,
  request: APIRequestContext,
  credentials: LoginDto,
): Promise<void> {
  const clientSessionId = randomUUID();
  const response = await new AuthClient(request).login(credentials, { headers: { 'X-Client-Session-Id': clientSessionId } });
  await expect(response, `API login of ${credentials.username}`).toHaveStatus(200);
  const session: LoginResponseDto = await response.json();
  if (session.mfaRequired) throw new Error(`${credentials.username} requires MFA; browser sign-in needs an account without it`);
  await context.addInitScript(({ token, refreshToken, sessionId }) => {
    // Only on the first load: a test that logs out must stay logged out after navigation.
    if (window.sessionStorage.getItem('pw-seeded') !== null) return;
    window.sessionStorage.setItem('pw-seeded', '1');
    window.localStorage.setItem('token', token);
    window.localStorage.setItem('refreshToken', refreshToken);
    window.localStorage.setItem('clientSessionId', sessionId);
  }, {
    token: session.token,
    refreshToken: session.refreshToken,
    sessionId: response.headers()['x-client-session-id'] ?? clientSessionId,
  });
}
