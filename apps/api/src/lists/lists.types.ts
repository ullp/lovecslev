import type { BaseUnit } from '@lovecslev/shared';

export type ListMatchStatus = 'RESOLVED_AUTO' | 'RESOLVED_CONFIRMED' | 'SUGGESTED' | 'UNRESOLVED';
export type ListMatchMethod = 'EXACT' | 'ALIAS' | 'TRIGRAM' | 'AI' | 'USER' | 'NONE';

export interface ListRecord {
  readonly id: string;
  readonly ownerUserId: string;
  readonly householdId: string | null;
  readonly name: string;
  readonly isShared: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ListSummary {
  readonly id: string;
  readonly householdId: string | null;
  readonly name: string;
  readonly isShared: boolean;
  readonly itemCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface ListItemRecord {
  readonly id: string;
  readonly listId: string;
  readonly rawText: string;
  readonly productId: string | null;
  readonly quantityBase: number;
  readonly baseUnit: BaseUnit;
  readonly matchStatus: ListMatchStatus;
  readonly matchMethod: ListMatchMethod;
  readonly matchConfidence: number | null;
  readonly sortOrder: number;
}

export interface AddItemInput {
  readonly listId: string;
  readonly rawText: string;
  readonly productId: string | null;
  readonly quantityBase: number;
  readonly baseUnit: BaseUnit;
  readonly matchStatus: ListMatchStatus;
  readonly matchMethod: ListMatchMethod;
  readonly matchConfidence: number | null;
}
