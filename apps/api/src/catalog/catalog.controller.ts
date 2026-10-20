import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../auth/auth.guard';
import { PremiumGuard } from '../subscriptions/premium.guard';
import { todayInPrague } from '../common/date';
import { CatalogService } from './catalog.service';
import { parseHistoryRange } from './price-history';
import {
  HistoryQueryDto,
  LeafletProductsQueryDto,
  LeafletsQueryDto,
  SearchQueryDto,
} from './dto/catalog-query.dto';

/** F1 + F2 endpointy (spec §13.2). Odpovědi mají envelope `{ data, meta }`. */
@Controller('v1')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('chains')
  async chains(@Query() query: LeafletsQueryDto) {
    const activeOn = query.activeOn ?? todayInPrague();
    return { data: await this.catalog.listChains(activeOn), meta: { activeOn } };
  }

  @Get('leaflets')
  async leaflets(@Query() query: LeafletsQueryDto) {
    const activeOn = query.activeOn ?? todayInPrague();
    const data = await this.catalog.listLeaflets(activeOn, query.chainCode);
    return { data, meta: { activeOn, chainCode: query.chainCode ?? null, total: data.length } };
  }

  @Get('leaflets/:id/products')
  async leafletProducts(@Param('id') id: string, @Query() query: LeafletProductsQueryDto) {
    const data = await this.catalog.getLeaflet(id, {
      ...(query.category === undefined ? {} : { category: query.category }),
      page: query.page,
      pageSize: query.pageSize,
    });
    return {
      data,
      meta: { page: data.page, pageSize: data.pageSize, total: data.total },
    };
  }

  @Get('products/search')
  async search(@Query() query: SearchQueryDto) {
    const activeOn = query.activeOn ?? todayInPrague();
    const result = await this.catalog.searchProducts(query.q, query.limit, activeOn);
    return { data: result.products, meta: { ...result.meta, activeOn } };
  }
  /** P3 — jen Premium (spec §7, §13.2). */
  @Get('products/:id/history')
  @UseGuards(AuthGuard, PremiumGuard)
  async history(@Param('id') id: string, @Query() query: HistoryQueryDto) {
    const days = parseHistoryRange(query.range);
    return { data: await this.catalog.getPriceHistory(id, days), meta: { rangeDays: days } };
  }
}
