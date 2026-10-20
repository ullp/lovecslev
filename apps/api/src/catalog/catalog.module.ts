import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CatalogController } from './catalog.controller';
import { CATALOG_REPOSITORY, SEARCH_PORT, type SearchPort } from './catalog.repository';
import { CatalogService } from './catalog.service';
import { HttpElasticClient } from './http-elastic.client';
import { PrismaCatalogRepository } from './prisma-catalog.repository';
import {
  ElasticSearchAdapter,
  FallbackSearchPort,
  PostgresSearchAdapter,
} from './search.adapters';

/**
 * Volba vyhledávacího enginu (D21):
 *  - `SEARCH_DRIVER=postgres` nebo chybějící `ELASTICSEARCH_URL` → jen PostgreSQL,
 *  - jinak Elasticsearch + automatický fallback na PostgreSQL.
 */
const searchProvider = {
  provide: SEARCH_PORT,
  inject: [PrismaService],
  useFactory: (prisma: PrismaService): SearchPort => {
    const postgres = new PostgresSearchAdapter(prisma);
    const url = process.env.ELASTICSEARCH_URL;
    const driver = (process.env.SEARCH_DRIVER ?? 'elasticsearch').toLowerCase();

    if (driver !== 'elasticsearch' || url === undefined || url === '') {
      return postgres;
    }

    return new FallbackSearchPort(new ElasticSearchAdapter(new HttpElasticClient(url)), postgres);
  },
};

@Module({
  imports: [PrismaModule, AuthModule, SubscriptionsModule],
  controllers: [CatalogController],
  providers: [
    CatalogService,
    { provide: CATALOG_REPOSITORY, useClass: PrismaCatalogRepository },
    searchProvider,
  ],
  exports: [CatalogService, CATALOG_REPOSITORY, SEARCH_PORT],
})
export class CatalogModule {}
