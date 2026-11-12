import { ApiClient, segment } from './api-client';

export class UserEditClient extends ApiClient {
  edit(username: string, body: Record<string, unknown>) {
    return this.put(`/api/v1/users/${segment(username)}`, body);
  }

  apiDocs() {
    return this.get('/v3/api-docs');
  }
}
