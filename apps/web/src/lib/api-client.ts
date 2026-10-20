import { apiRequest, apiRequestWithMeta } from './api';
import type {
  ChainView,
  Household,
  PriceAlert,
  PriceHistory,
  StoreNearby,
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

  storesNearby: (params: { lat: number; lng: number; radiusKm?: number; activeOn?: string }) =>
    apiRequest<readonly StoreNearby[]>('/v1/stores/nearby', {
      query: {
        lat: params.lat,
        lng: params.lng,
        radiusKm: params.radiusKm,
        activeOn: params.activeOn,
      },
    }),

  history: (token: string, productId: string, range = '90d') =>
    apiRequest<PriceHistory>(`/v1/products/${productId}/history`, { token, query: { range } }),

  alerts: (token: string) => apiRequest<readonly PriceAlert[]>('/v1/alerts', { token }),

  createAlert: (
    token: string,
    body: { productId: string; targetUnitPriceMinor: number; chainCode?: string },
  ) => apiRequest<PriceAlert>('/v1/alerts', { method: 'POST', token, body }),

  deleteAlert: (token: string, alertId: string) =>
    apiRequest<null>(`/v1/alerts/${alertId}`, { method: 'DELETE', token }),

  registerPushToken: (token: string, body: { token: string; platform: 'IOS' | 'ANDROID' }) =>
    apiRequest<null>('/v1/devices/push-token', { method: 'POST', token, body }),

  households: (token: string) => apiRequest<readonly Household[]>('/v1/households', { token }),

  createHousehold: (token: string, name: string) =>
    apiRequest<{ id: string; name: string; ownerUserId: string }>('/v1/households', {
      method: 'POST',
      token,
      body: { name },
    }),

  inviteToHousehold: (token: string, householdId: string, email: string) =>
    apiRequest<{ invitationId: string; email: string; expiresAt: string; token: string }>(
      `/v1/households/${householdId}/invitations`,
      { method: 'POST', token, body: { email } },
    ),

  acceptInvitation: (token: string, invitationToken: string) =>
    apiRequest<Household>('/v1/households/invitations/accept', {
      method: 'POST',
      token,
      body: { token: invitationToken },
    }),

  removeHouseholdMember: (token: string, householdId: string, userId: string) =>
    apiRequest<null>(`/v1/households/${householdId}/members/${userId}`, { method: 'DELETE', token }),
};
