import { Injectable } from '@nestjs/common';
import type { BaseUnit } from '@lovecslev/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { ListsRepository } from './lists.repository';
import type { AddItemInput, ListItemRecord, ListRecord, ListSummary } from './lists.types';

const LIST_SELECT = {
  id: true,
  ownerUserId: true,
  householdId: true,
  name: true,
  isShared: true,
  createdAt: true,
  updatedAt: true,
} as const;

const ITEM_SELECT = {
  id: true,
  listId: true,
  rawText: true,
  productId: true,
  quantityBase: true,
  baseUnit: true,
  matchStatus: true,
  matchMethod: true,
  matchConfidence: true,
  sortOrder: true,
} as const;

@Injectable()
export class PrismaListsRepository implements ListsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async countLists(ownerUserId: string): Promise<number> {
    return this.prisma.shoppingList.count({ where: { ownerUserId, deletedAt: null } });
  }

  async create(input: { ownerUserId: string; name: string; householdId: string | null }): Promise<ListRecord> {
    return this.prisma.shoppingList.create({
      data: {
        ownerUserId: input.ownerUserId,
        name: input.name,
        householdId: input.householdId,
        isShared: input.householdId !== null,
      },
      select: LIST_SELECT,
    });
  }

  async listSummaries(ownerUserId: string): Promise<readonly ListSummary[]> {
    const lists = await this.prisma.shoppingList.findMany({
      where: { ownerUserId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
      select: { ...LIST_SELECT, _count: { select: { items: true } } },
    });

    return lists.map((list) => ({
      id: list.id,
      householdId: list.householdId,
      name: list.name,
      isShared: list.isShared,
      itemCount: list._count.items,
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    }));
  }

  async find(listId: string): Promise<ListRecord | null> {
    return this.prisma.shoppingList.findFirst({
      where: { id: listId, deletedAt: null },
      select: LIST_SELECT,
    });
  }

  async rename(listId: string, name: string): Promise<void> {
    await this.prisma.shoppingList.update({ where: { id: listId }, data: { name } });
  }

  async softDelete(listId: string): Promise<void> {
    await this.prisma.shoppingList.update({
      where: { id: listId },
      data: { deletedAt: new Date() },
    });
  }

  async countItems(listId: string): Promise<number> {
    return this.prisma.shoppingListItem.count({ where: { listId } });
  }

  async addItem(input: AddItemInput): Promise<ListItemRecord> {
    const sortOrder = await this.countItems(input.listId);
    return this.toItem(
      await this.prisma.shoppingListItem.create({
        data: {
          listId: input.listId,
          rawText: input.rawText,
          productId: input.productId,
          quantityBase: input.quantityBase,
          baseUnit: input.baseUnit,
          matchStatus: input.matchStatus,
          matchMethod: input.matchMethod,
          matchConfidence: input.matchConfidence,
          sortOrder,
        },
        select: ITEM_SELECT,
      }),
    );
  }

  async listItems(listId: string): Promise<readonly ListItemRecord[]> {
    const items = await this.prisma.shoppingListItem.findMany({
      where: { listId },
      orderBy: { sortOrder: 'asc' },
      select: ITEM_SELECT,
    });
    return items.map((item) => this.toItem(item));
  }

  async findItem(itemId: string): Promise<ListItemRecord | null> {
    const item = await this.prisma.shoppingListItem.findUnique({
      where: { id: itemId },
      select: ITEM_SELECT,
    });
    return item === null ? null : this.toItem(item);
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
    const item = await this.prisma.shoppingListItem.update({
      where: { id: itemId },
      data: patch,
      select: ITEM_SELECT,
    });
    return this.toItem(item);
  }

  async deleteItem(itemId: string): Promise<void> {
    await this.prisma.shoppingListItem.delete({ where: { id: itemId } });
  }

  private toItem(row: {
    id: string;
    listId: string;
    rawText: string;
    productId: string | null;
    quantityBase: unknown;
    baseUnit: string;
    matchStatus: string;
    matchMethod: string;
    matchConfidence: unknown;
    sortOrder: number;
  }): ListItemRecord {
    return {
      id: row.id,
      listId: row.listId,
      rawText: row.rawText,
      productId: row.productId,
      quantityBase: Number(row.quantityBase),
      baseUnit: row.baseUnit as BaseUnit,
      matchStatus: row.matchStatus as ListItemRecord['matchStatus'],
      matchMethod: row.matchMethod as ListItemRecord['matchMethod'],
      matchConfidence: row.matchConfidence === null ? null : Number(row.matchConfidence),
      sortOrder: row.sortOrder,
    };
  }
}
