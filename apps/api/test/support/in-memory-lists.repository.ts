import { randomUUID } from 'node:crypto';
import type { BaseUnit } from '@lovecslev/shared';
import type { ListsRepository } from '../../src/lists/lists.repository';
import type {
  AddItemInput,
  ListItemRecord,
  ListRecord,
  ListSummary,
} from '../../src/lists/lists.types';

export class InMemoryListsRepository implements ListsRepository {
  readonly lists: ListRecord[] = [];
  readonly items: ListItemRecord[] = [];
  private readonly deleted = new Set<string>();

  constructor(seedLists: readonly ListRecord[] = []) {
    this.lists.push(...seedLists);
  }

  async countLists(ownerUserId: string): Promise<number> {
    return this.lists.filter((list) => list.ownerUserId === ownerUserId && !this.deleted.has(list.id))
      .length;
  }

  async create(input: { ownerUserId: string; name: string; householdId: string | null }): Promise<ListRecord> {
    const now = new Date();
    const list: ListRecord = {
      id: randomUUID(),
      ownerUserId: input.ownerUserId,
      householdId: input.householdId,
      name: input.name,
      isShared: input.householdId !== null,
      createdAt: now,
      updatedAt: now,
    };
    this.lists.push(list);
    return list;
  }

  async listSummaries(ownerUserId: string): Promise<readonly ListSummary[]> {
    return this.lists
      .filter((list) => list.ownerUserId === ownerUserId && !this.deleted.has(list.id))
      .map((list) => ({
        id: list.id,
        householdId: list.householdId,
        name: list.name,
        isShared: list.isShared,
        itemCount: this.items.filter((item) => item.listId === list.id).length,
        createdAt: list.createdAt,
        updatedAt: list.updatedAt,
      }));
  }

  async find(listId: string): Promise<ListRecord | null> {
    if (this.deleted.has(listId)) return null;
    return this.lists.find((list) => list.id === listId) ?? null;
  }

  async rename(listId: string, name: string): Promise<void> {
    const list = this.lists.find((entry) => entry.id === listId);
    if (list !== undefined) {
      (list as { name: string }).name = name;
    }
  }

  async softDelete(listId: string): Promise<void> {
    this.deleted.add(listId);
  }

  async countItems(listId: string): Promise<number> {
    return this.items.filter((item) => item.listId === listId).length;
  }

  async addItem(input: AddItemInput): Promise<ListItemRecord> {
    const item: ListItemRecord = {
      id: randomUUID(),
      listId: input.listId,
      rawText: input.rawText,
      productId: input.productId,
      quantityBase: input.quantityBase,
      baseUnit: input.baseUnit,
      matchStatus: input.matchStatus,
      matchMethod: input.matchMethod,
      matchConfidence: input.matchConfidence,
      sortOrder: this.items.filter((entry) => entry.listId === input.listId).length,
    };
    this.items.push(item);
    return item;
  }

  async listItems(listId: string): Promise<readonly ListItemRecord[]> {
    return this.items
      .filter((item) => item.listId === listId)
      .sort((a, b) => a.sortOrder - b.sortOrder);
  }

  async findItem(itemId: string): Promise<ListItemRecord | null> {
    return this.items.find((item) => item.id === itemId) ?? null;
  }

  async updateItem(
    itemId: string,
    patch: {
      productId?: string | null;
      quantityBase?: number;
      baseUnit?: BaseUnit;
      matchStatus?: ListItemRecord['matchStatus'];
      matchMethod?: ListItemRecord['matchMethod'];
      matchConfidence?: number | null;
    },
  ): Promise<ListItemRecord> {
    const item = this.items.find((entry) => entry.id === itemId);
    if (item === undefined) throw new Error(`Položka ${itemId} neexistuje`);
    Object.assign(item, patch);
    return item;
  }

  async deleteItem(itemId: string): Promise<void> {
    const index = this.items.findIndex((item) => item.id === itemId);
    if (index >= 0) this.items.splice(index, 1);
  }
}
