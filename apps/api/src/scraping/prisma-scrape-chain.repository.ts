import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { ChainScrapeTarget, ScrapeChainRepository } from './scraping.types';

@Injectable()
export class PrismaScrapeChainRepository implements ScrapeChainRepository {
  constructor(private readonly prisma: PrismaService) {}

  async listTargets(): Promise<readonly ChainScrapeTarget[]> {
    const chains = await this.prisma.chain.findMany({
      where: { isActive: true, isMvp: true },
      orderBy: { code: 'asc' },
      select: {
        id: true,
        code: true,
        legalApproved: true,
        scrapeFailures: true,
        scrapePausedUntil: true,
      },
    });

    return chains.map((chain) => ({
      id: chain.id,
      code: chain.code,
      legalApproved: chain.legalApproved,
      failures: chain.scrapeFailures,
      pausedUntil: chain.scrapePausedUntil,
    }));
  }

  async recordFailure(chainId: string, pauseUntil: Date, failures: number): Promise<void> {
    await this.prisma.chain.update({
      where: { id: chainId },
      data: {
        scrapeFailures: failures,
        ...(failures >= 2 ? { scrapePausedUntil: pauseUntil } : {}),
      },
    });
  }

  async resetFailures(chainId: string): Promise<void> {
    await this.prisma.chain.update({
      where: { id: chainId },
      data: { scrapeFailures: 0, scrapePausedUntil: null },
    });
  }
}
