/** One recorded request of the traffic monitor (GET /api/v1/traffic/logs). */
export interface TrafficLogEntryDto {
  correlationId: string;
  timestamp: string;
  clientSessionId: string;
  method: string;
  path: string;
  status: number;
  requestBody: unknown;
  responseBody: unknown;
}
