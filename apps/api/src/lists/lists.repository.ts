import type { BaseUnit } from '@lovecslev/shared';
import type {
  AddItemInput,
  ListItemRecord,
  ListRecord,
  ListSummary,
} from './lists.types';

/** Port nad seznamy (spec §9.10) — služba nezná Prisma. */
export interface ListsRepository {
  countLists(ownerUserId: string): Promise<number>;
  create(input: { ownerUserId: string; name: string; householdId: string | null }): Promise<ListRecord>;
  listSummaries(ownerUserId: string): Promise<readonly ListSummary[]>;
  find(listId: string): Promise<ListRecord | null>;
  rename(listId: string, name: string): Promise<void>;
  softDelete(listId: string): Promise<void>;

  countItems(listId: string): Promise<number>;
  addItem(input: AddItemInput): Promise<ListItemRecord>;
  listItems(listId: string): Promise<readonly ListItemRecord[]>;
  findItem(itemId: string): Promise<ListItemRecord | null>;
  updateItem(
    itemId: string,
    patch: {
      productId?: string | null;
      quantityBase?: number;
      baseUnit?: BaseUnit;
      matchStatus?: ListItemRecord['matchStatus'];
      matchMethod?: ListItemRecord['matchMethod'];
      matchConfidence?: number | null;
    },
  ): Promise<ListItemRecord>;
  deleteItem(itemId: string): Promise<void>;
}

export const LISTS_REPOSITORY = Symbol('LISTS_REPOSITORY');
