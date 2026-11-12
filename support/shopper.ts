import { expect } from './expect';
import { step } from './step';
import { type APIRequestContext } from '@playwright/test';
import { CartClient } from '@api/cart.client';
import { OrdersClient } from '@api/orders.client';
import { PaymentsClient, TEST_CARDS, THREE_DS_CODE } from '@api/payments.client';
import { SearchClient } from '@api/search.client';
import { TaxClient } from '@api/tax.client';
import { CartTendersClient, GiftCardsClient, LoyaltyClient } from '@api/tenders.client';
import { TrackingClient } from '@api/warehouse.client';
import { WebhooksClient } from '@api/webhooks.client';
import { ASYNC_TIMEOUT, POLL_INTERVALS } from '@config';
import type { AddressDto, OrderDto, OrderStatus } from '@models/order';
import type { PaymentDto, PaymentStatus } from '@models/payment';
import type { ProductCreateDto, ProductDto } from '@models/product';
import type { LoyaltyAccountDto } from '@models/tenders';
import type { UserRegisterDto } from '@models/user';
import { addresses } from './addresses';
import type { ApiTestContext } from './api-test-context';

export interface CartLine {
  product: ProductDto;
  quantity: number;
}

// A freshly registered customer with every customer-facing client bound to their token.
export class Shopper {
  readonly cart: CartClient;
  readonly orders: OrdersClient;
  readonly payments: PaymentsClient;
  readonly tenders: CartTendersClient;
  readonly giftCards: GiftCardsClient;
  readonly loyalty: LoyaltyClient;
  readonly tracking: TrackingClient;
  readonly webhooks: WebhooksClient;
  readonly search: SearchClient;
  readonly tax: TaxClient;

  private constructor(
    readonly api: ApiTestContext,
    readonly user: UserRegisterDto,
    readonly token: string,
  ) {
    const request: APIRequestContext = api.request;
    this.cart = new CartClient(request, token);
    this.orders = new OrdersClient(request, token);
    this.payments = new PaymentsClient(request, token);
    this.tenders = new CartTendersClient(request, token);
    this.giftCards = new GiftCardsClient(request, token);
    this.loyalty = new LoyaltyClient(request, token);
    this.tracking = new TrackingClient(request, token);
    this.webhooks = new WebhooksClient(request, token);
    this.search = new SearchClient(request, token);
    this.tax = new TaxClient(request, token);
  }

  static async create(api: ApiTestContext): Promise<Shopper> {
    const { user, token } = await api.createUser();
    return new Shopper(api, user, token);
  }

  get username(): string {
    return this.user.username;
  }

  @step('add product {0} to the cart')
  async addToCart(product: ProductDto, quantity = 1): Promise<void> {
    const response = await this.cart.addItem({ productId: product.id, quantity });
    await expect(response, `Add product ${product.id} to the cart`).toHaveStatus(200);
  }

  // Creates a product the test owns and puts it in the cart.
  @step('put a new product in the cart')
  async fillCart(overrides: Partial<ProductCreateDto> = {}, quantity = 1): Promise<CartLine> {
    const product = await this.api.createProduct({ stockQuantity: 50, ...overrides });
    await this.addToCart(product, quantity);
    return { product, quantity };
  }

  @step('check out')
  async checkout(address: AddressDto = addresses.poland): Promise<OrderDto> {
    const response = await this.orders.create(address);
    await expect(response, 'Checkout').toHaveStatus(201);
    return response.json();
  }

  // One product at the given price, ordered to Poland unless another address is passed.
  @step('place an order of {0}')
  async placeOrder(price = 100, address: AddressDto = addresses.poland): Promise<{ order: OrderDto } & CartLine> {
    const line = await this.fillCart({ price });
    return { ...line, order: await this.checkout(address) };
  }

  @step('pay order {0} by card')
  async pay(orderId: number, cardNumber: string = TEST_CARDS.visa): Promise<PaymentDto> {
    const response = await this.payments.pay(orderId, cardNumber);
    await expect(response, `Payment of order ${orderId}`).toHaveStatus(201);
    return response.json();
  }

  // Pays with a card that captures immediately (3-D Secure cards are completed with the right code)
  // and waits until the backend has marked the order PAID.
  @step('pay order {0} and wait until it is PAID')
  async payAndWaitForPaid(orderId: number, cardNumber: string = TEST_CARDS.visa): Promise<PaymentDto> {
    let payment = await this.pay(orderId, cardNumber);
    if (payment.status === 'REQUIRES_ACTION') {
      const response = await this.payments.submit3ds(payment.id, THREE_DS_CODE);
      await expect(response, '3-D Secure confirmation').toHaveStatus(200);
      payment = await response.json();
    }
    await this.waitForOrderStatus(orderId, 'PAID');
    return payment;
  }

  async getOrder(orderId: number): Promise<OrderDto> {
    const response = await this.orders.getById(orderId);
    await expect(response, `Read order ${orderId}`).toHaveStatus(200);
    return response.json();
  }

  async getPayment(paymentId: string): Promise<PaymentDto> {
    const response = await this.payments.getById(paymentId);
    await expect(response, `Read payment ${paymentId}`).toHaveStatus(200);
    return response.json();
  }

  async loyaltyAccount(): Promise<LoyaltyAccountDto> {
    const response = await this.loyalty.account();
    await expect(response, 'Read loyalty account').toHaveStatus(200);
    return response.json();
  }

  @step('wait until order {0} is {1}')
  async waitForOrderStatus(orderId: number, status: OrderStatus, timeout = ASYNC_TIMEOUT): Promise<OrderDto> {
    await expect
      .poll(async () => (await this.getOrder(orderId)).status, { message: `order ${orderId} becomes ${status}`, timeout, intervals: POLL_INTERVALS })
      .toBe(status);
    return this.getOrder(orderId);
  }

  @step('wait until payment {0} is {1}')
  async waitForPaymentStatus(paymentId: string, status: PaymentStatus, timeout = ASYNC_TIMEOUT): Promise<PaymentDto> {
    await expect
      .poll(async () => (await this.getPayment(paymentId)).status, { message: `payment ${paymentId} becomes ${status}`, timeout, intervals: POLL_INTERVALS })
      .toBe(status);
    return this.getPayment(paymentId);
  }
}
