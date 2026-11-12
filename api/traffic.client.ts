import { ApiClient } from './api-client';

export const TRAFFIC_LOGS_ENDPOINT = '/api/v1/traffic/logs';

/** The traffic monitor's recorded requests, read for one X-Client-Session-Id. */
export class TrafficClient extends ApiClient {
  logs(clientSessionId: string, filter: { pathContains?: string; size?: number } = {}) {
    return this.get(TRAFFIC_LOGS_ENDPOINT, { size: 100, ...filter }, { 'X-Client-Session-Id': clientSessionId });
  }
}
