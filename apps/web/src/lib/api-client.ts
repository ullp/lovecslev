import { apiRequest, apiRequestWithMeta } from './api';
import type {
  ChainView,
  LeafletDetail,
  LeafletSummary,
  ListDetail,
  ListItem,
  ListSummary,
  OptimizationResult,
  ProductSearchResult,
  PublicUser,
  SearchMeta,
  TokenPair,
} from './types';

/** Typované volání API (kontrakt spec §13). */
export const api = {
  chains: (activeOn?: string) =>
    apiRequest<readonly ChainView[]>('/v1/chains', { query: { activeOn } }),

  leaflets: (params: { activeOn?: string; chainCode?: string } = {}) =>
    apiRequestWithMeta<readonly LeafletSummary[]>('/v1/leaflets', { query: params }),

  leaflet: (id: string, params: { category?: string; page?: number; pageSize?: number } = {}) =>
    apiRequest<LeafletDetail>(`/v1/leaflets/${id}/products`, { query: params }),

  search: async (q: string, params: { activeOn?: string; limit?: number } = {}) => {
    const response = await apiRequestWithMeta<readonly ProductSearchResult[]>('/v1/products/search', {
      query: { q, ...params },
    });
    return { data: response.data, meta: (response.meta ?? {}) as unknown as SearchMeta };
  },

  register: (body: { email: string; password: string; displayName?: string }) =>
    apiRequest<{ user: PublicUser; tokens: TokenPair }>('/v1/auth/register', {
      method: 'POST',
      body,
    }),

  login: (body: { email: string; password: string }) =>
    apiRequest<{ user: PublicUser; tokens: TokenPair }>('/v1/auth/login', {
      method: 'POST',
      body,
    }),

  refresh: (refreshToken: string) =>
    apiRequest<{ tokens: TokenPair }>('/v1/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    }),

  logout: (token: string, refreshToken: string) =>
    apiRequest<null>('/v1/auth/logout', { method: 'POST', token, body: { refreshToken } }),

  lists: (token: string) => apiRequest<readonly ListSummary[]>('/v1/lists', { token }),

  list: (token: string, id: string) => apiRequest<ListDetail>(`/v1/lists/${id}`, { token }),

  createList: (token: string, name: string) =>
    apiRequest<ListSummary>('/v1/lists', { method: 'POST', token, body: { name } }),

  deleteList: (token: string, id: string) =>
    apiRequest<null>(`/v1/lists/${id}`, { method: 'DELETE', token }),

  addItem: (token: string, listId: string, body: { rawText: string; quantityBase?: number }) =>
    apiRequest<ListItem>(`/v1/lists/${listId}/items`, { method: 'POST', token, body }),

  updateItem: (
    token: string,
    listId: string,
    itemId: string,
    body: { productId?: string; quantityBase?: number },
  ) => apiRequest<ListItem>(`/v1/lists/${listId}/items/${itemId}`, { method: 'PATCH', token, body }),

  deleteItem: (token: string, listId: string, itemId: string) =>
    apiRequest<null>(`/v1/lists/${listId}/items/${itemId}`, { method: 'DELETE', token }),

  optimize: (
    token: string,
    listId: string,
    body: { date?: string; maxStores?: number; includeVariantB?: boolean } = {},
  ) =>
    apiRequest<OptimizationResult>(`/v1/lists/${listId}/optimize`, {
      method: 'POST',
      token,
      body,
    }),
};
