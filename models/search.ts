export type SearchSort = 'relevance' | 'newest' | 'price_asc' | 'price_desc' | 'name_asc' | 'rating_desc';

export interface ProductSearchQuery {
  q?: string;
  category?: string[];
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  inStock?: boolean;
  sort?: SearchSort;
  page?: number;
  size?: number;
}

export interface ProductSearchItemDto {
  id: number;
  name: string;
  description: string;
  price: number;
  stockQuantity: number;
  category: string;
  imageUrl: string | null;
  createdAt: string;
  updatedAt: string;
  averageRating: number | null;
  reviewCount: number;
}

export interface ProductSearchResultDto {
  content: ProductSearchItemDto[];
  pageNumber: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
  facets: {
    categories: { value: string; count: number }[];
    priceRange: { min: number | null; max: number | null };
    inStockCount: number;
  };
}
