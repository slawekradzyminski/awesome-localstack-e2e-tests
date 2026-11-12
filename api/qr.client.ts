import { ApiClient } from './api-client';

export const QR_ENDPOINT = '/api/v1/qr/create';

export class QrClient extends ApiClient {
  create(text: string) {
    return this.post(QR_ENDPOINT, { text }, { Accept: 'image/png' });
  }
}
