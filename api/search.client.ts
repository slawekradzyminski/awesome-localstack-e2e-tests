import { ApiClient, type Query } from './api-client';
import type { ProductSearchQuery } from '@models/search';

export const SEARCH_ENDPOINT = '/api/v1/products/search';

export class SearchClient extends ApiClient {
  search(query: ProductSearchQuery | Query = {}) {
    return this.get(SEARCH_ENDPOINT, query as Query);
  }
}
