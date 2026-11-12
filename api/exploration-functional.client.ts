import { ApiClient, segment } from './api-client';

// Calls used by the exploration regression specs (catalog X-02, X-06, X-10, X-18, X-21, X-24).
// Bodies are sent as given, so validation tests can leave fields out.
export class ExplorationFunctionalClient extends ApiClient {
  forget(username: string) {
    return this.delete(`/api/v1/users/${segment(username)}/right-to-be-forgotten`);
  }

  sendEmail(body: unknown) {
    return this.post('/api/v1/email', body);
  }

  createQr(text: string, accept: string) {
    return this.post('/api/v1/qr/create', { text }, { Accept: accept });
  }

  getPath(path: string) {
    return this.get(path);
  }

  patchPath(path: string) {
    return this.request.patch(path, { headers: this.token ? { Authorization: `Bearer ${this.token}` } : {} });
  }

  signIn(body: unknown) {
    return this.post('/api/v1/users/signin', body);
  }

  apiDocs() {
    return this.get('/v3/api-docs');
  }
}
