/** Tarify a jejich limity (spec §7). Jediný zdroj pravdy pro FE i BE. */
export type Plan = 'FREE' | 'PREMIUM';

export const PLAN_LIMITS = {
  FREE: { maxLists: 1, maxItemsPerList: 30, maxAlerts: 0 },
  PREMIUM: { maxLists: Number.POSITIVE_INFINITY, maxItemsPerList: Number.POSITIVE_INFINITY, maxAlerts: 20 },
} as const satisfies Record<Plan, { maxLists: number; maxItemsPerList: number; maxAlerts: number }>;

export function isPremium(value: unknown): value is 'PREMIUM' {
  return value === 'PREMIUM';
}
