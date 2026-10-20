import { Controller, Get, Param, Query } from '@nestjs/common';
import { todayInPrague } from '../common/date';
import { CatalogService } from './catalog.service';
import {
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
}
