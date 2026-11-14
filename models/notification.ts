import type { PageDto } from './page';

// notification-service 1.0.0: commerce emails rendered from notification.requested feed events.
export type NotificationTemplate =
  | 'PAYMENT_RECEIVED' | 'PAYMENT_FAILED' | 'BACK_IN_STOCK' | 'ORDER_SHIPPED' | 'ORDER_DELIVERED' | 'RETURN_UPDATED'
  | 'SHIPMENT_OUT_FOR_DELIVERY' | 'SHIPMENT_DELIVERY_FAILED' | 'LOYALTY_POINTS_EARNED' | 'GIFT_CARD_ISSUED';

export type NotificationEmailStatus = 'QUEUED' | 'SENT' | 'FAILED';

export interface NotificationEmailDto {
  id: string;
  template: NotificationTemplate;
  subject: string;
  status: NotificationEmailStatus;
  recipientMasked: string;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
  failureReason: string | null;
}

export type NotificationEmailPageDto = PageDto<NotificationEmailDto>;

// GET /api/v1/local/notifications/outbox: what the local-outbox transport captured, oldest first.
export interface OutboxEmailDto {
  timestamp: string;
  destination: string;
  payload: {
    to: string;
    subject: string;
    message: string;
    template: NotificationTemplate | null;
    properties: Record<string, string>;
  };
}
