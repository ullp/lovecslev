import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AdvisorUsageRepository, AdvisorUsageResult } from './advisor.types';

const toDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

@Injectable()
export class PrismaAdvisorUsageRepository implements AdvisorUsageRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Inkrementuje počítadlo a vrátí, zda je dotaz v rámci denního limitu (atomicky). */
  async incrementAndCheck(userId: string, day: string, limit: number): Promise<AdvisorUsageResult> {
    const row = await this.prisma.advisorUsage.upsert({
      where: { userId_day: { userId, day: toDate(day) } },
      create: { userId, day: toDate(day), requests: 1 },
      update: { requests: { increment: 1 } },
      select: { requests: true },
    });

    return { allowed: row.requests <= limit, used: row.requests };
  }
}
