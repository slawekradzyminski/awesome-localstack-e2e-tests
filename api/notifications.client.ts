import { ApiClient } from './api-client';

export const NOTIFICATION_EMAILS_ENDPOINT = '/api/v1/notifications/emails';
export const NOTIFICATION_OUTBOX_ENDPOINT = '/api/v1/local/notifications/outbox';

// notification-service: the caller's commerce emails, and (ROLE_ADMIN) the local outbox transport.
export class NotificationsClient extends ApiClient {
  emails(params: { username?: string; page?: number; size?: number } = {}) {
    return this.get(NOTIFICATION_EMAILS_ENDPOINT, params);
  }

  outbox() {
    return this.get(NOTIFICATION_OUTBOX_ENDPOINT);
  }
}
