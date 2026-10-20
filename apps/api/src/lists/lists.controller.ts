import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard, CurrentUser } from '../auth/auth.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AddItemDto, CreateListDto, OptimizeListDto, RenameListDto, UpdateItemDto } from './dto/lists.dto';
import { ListsService } from './lists.service';

/** F3 + F4 endpointy (spec §13.2) — všechny vyžadují přihlášení. */
@Controller('v1/lists')
@UseGuards(AuthGuard)
export class ListsController {
  constructor(private readonly lists: ListsService) {}

  @Get()
  async list(@CurrentUser() user: AuthenticatedUser) {
    const data = await this.lists.list(user.userId);
    return { data, meta: { total: data.length } };
  }

  @Post()
  async create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateListDto) {
    return { data: await this.lists.create(user.userId, dto.name, dto.householdId ?? null) };
  }

  @Get(':id')
  async get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) {
    return { data: await this.lists.get(user.userId, id) };
  }

  @Patch(':id')
  @HttpCode(204)
  async rename(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: RenameListDto,
  ): Promise<void> {
    await this.lists.rename(user.userId, id, dto.name);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<void> {
    await this.lists.remove(user.userId, id);
  }

  @Post(':id/items')
  async addItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AddItemDto,
  ) {
    return {
      data: await this.lists.addItem(user.userId, id, {
        rawText: dto.rawText,
        ...(dto.quantityBase === undefined ? {} : { quantityBase: dto.quantityBase }),
      }),
    };
  }

  @Patch(':id/items/:itemId')
  async updateItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return {
      data: await this.lists.updateItem(user.userId, id, itemId, {
        ...(dto.productId === undefined ? {} : { productId: dto.productId }),
        ...(dto.quantityBase === undefined ? {} : { quantityBase: dto.quantityBase }),
      }),
    };
  }

  @Delete(':id/items/:itemId')
  @HttpCode(204)
  async removeItem(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ): Promise<void> {
    await this.lists.removeItem(user.userId, id, itemId);
  }

  @Post(':id/optimize')
  @HttpCode(200)
  async optimize(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: OptimizeListDto,
  ) {
    const result = await this.lists.optimize(user.userId, id, {
      ...(dto.date === undefined ? {} : { date: dto.date }),
      ...(dto.maxStores === undefined ? {} : { maxStores: dto.maxStores }),
      ...(dto.tripPenaltyMinor === undefined ? {} : { tripPenaltyMinor: dto.tripPenaltyMinor }),
      ...(dto.includeVariantB === undefined ? {} : { includeVariantB: dto.includeVariantB }),
    });

    return { data: result, meta: { lockedFeatures: result.meta.lockedFeatures } };
  }
}
