import { randomBytes } from 'node:crypto';
import { expect } from '@support/expect';
import type { SearchClient } from '@api/search.client';
import type { ProductSearchQuery, ProductSearchResultDto } from '@models/search';
import type { ProductCreateDto, ProductDto } from '@models/product';
import type { Query } from '@api/api-client';
import type { ApiTestContext } from './api-test-context';
import type { Shopper } from './shopper';
import type { Warehouse } from './staff';

// The catalogue is shared by every agent and test run, so each search test works inside its own token:
// product names and categories carry it and every query filters on it.
export function searchToken(): string {
  return `pw${randomBytes(6).toString('hex')}`;
}

// A product whose name, description and category are fully controlled, so text matches are predictable.
export async function createSearchProduct(api: ApiTestContext, product: Partial<ProductCreateDto> & Pick<ProductCreateDto, 'name' | 'category'>): Promise<ProductDto> {
  return api.createProduct({ description: 'Plain catalogue item', price: 10, stockQuantity: 10, imageUrl: null, ...product });
}

export async function searchProducts(search: SearchClient, query: ProductSearchQuery | Query): Promise<ProductSearchResultDto> {
  const response = await search.search(query);
  await expect(response, `Search ${JSON.stringify(query)}`).toHaveStatus(200);
  return response.json();
}

export const names = (result: ProductSearchResultDto) => result.content.map((item) => item.name);

// Approved reviews need a DELIVERED order containing the product: the shopper buys every product in one order,
// the warehouse delivers it through the simulated carrier, the shopper reviews and the admin approves.
export async function deliverAndReview(
  shopper: Shopper,
  warehouse: Warehouse,
  ratings: { product: ProductDto; rating: number }[],
): Promise<void> {
  for (const { product } of ratings) await shopper.addToCart(product);
  const order = await shopper.checkout();
  await shopper.payAndWaitForPaid(order.id);
  const shipment = await warehouse.shipSimulated(order.id);
  await warehouse.advanceUntil(shipment, 'DELIVERED');
  await shopper.waitForOrderStatus(order.id, 'DELIVERED');

  const request = shopper.api.request;
  const adminHeaders = { Authorization: `Bearer ${await shopper.api.getAdminToken()}` };
  for (const { product, rating } of ratings) {
    const created = await request.post(`/api/v1/products/${product.id}/reviews`, {
      data: { rating, title: `Rated ${rating}`, body: 'Playwright search rating fixture.' },
      headers: { Authorization: `Bearer ${shopper.token}` },
    });
    await expect(created, `Review of product ${product.id}`).toHaveStatus(201);
    const { id } = await created.json();
    const moderated = await request.put(`/api/v1/admin/reviews/${id}/moderation`, { data: { decision: 'APPROVED' }, headers: adminHeaders });
    await expect(moderated, `Approval of review ${id}`).toHaveStatus(200);
  }
}
