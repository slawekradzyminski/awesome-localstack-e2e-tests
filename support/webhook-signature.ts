import { createHmac, timingSafeEqual } from 'node:crypto';

// X-Webhook-Signature: t=<epoch seconds>,v1=<hex HMAC-SHA256(secret, t + "." + rawBody)>
export function parseSignature(header: string): { t: string; v1: string } {
  const parts = Object.fromEntries(header.split(',').map(part => part.split('=', 2) as [string, string]));
  if (!parts.t || !parts.v1) throw new Error(`Malformed webhook signature: ${header}`);
  return { t: parts.t, v1: parts.v1 };
}

export function signatureMatches(secret: string, header: string, rawBody: string): boolean {
  const { t, v1 } = parseSignature(header);
  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest();
  const actual = Buffer.from(v1, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

// Inbox headers keep the sender's case; look them up case-insensitively.
export function header(headers: Record<string, string>, name: string): string | undefined {
  const key = Object.keys(headers).find(candidate => candidate.toLowerCase() === name.toLowerCase());
  return key === undefined ? undefined : headers[key];
}
