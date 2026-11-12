import { ApiClient } from './api-client';

export const GRAPHQL_ENDPOINT = '/api/v1/graphql';

export class GraphQlClient extends ApiClient {
  execute(query: string, variables: Record<string, unknown> = {}) {
    return this.post(GRAPHQL_ENDPOINT, { query, variables });
  }
}
