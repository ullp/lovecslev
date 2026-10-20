/**
 * CLI vyhodnocení hlídače cen (spec §6 P2, §14.3 bod 6).
 * Spouští se po importu letáků: `npm run alerts:evaluate --workspace=@slevari/api`
 */
import 'reflect-metadata';
import { AlertEvaluationService } from '../alerts/alert-evaluation.service';
import { ALERT_REPOSITORY, PUSH_TOKEN_REPOSITORY } from '../alerts/alerts.types';
import { ExpoPushSender } from '../alerts/notification.sender';
import { PrismaAlertRepository, PrismaPushTokenRepository } from '../alerts/prisma-alerts.repository';
import { PrismaCatalogRepository } from '../catalog/prisma-catalog.repository';
import { PrismaService } from '../prisma/prisma.service';

async function main(): Promise<void> {
  const prisma = new PrismaService();
  await prisma.$connect();

  try {
    const service = new AlertEvaluationService(
      new PrismaAlertRepository(prisma),
      new PrismaPushTokenRepository(prisma),
      new PrismaCatalogRepository(prisma),
      new ExpoPushSender(),
    );

    // Volitelně `--date=YYYY-MM-DD` (deterministické testy/demo; job jinak bere „dnes“).
    const dateArg = process.argv.find((arg) => arg.startsWith('--date='));
    const activeOn = dateArg?.split('=')[1];

    const report = await service.evaluate(activeOn === undefined ? {} : { activeOn });
    console.log(JSON.stringify(report, null, 2));

    if (report.failed > 0) {
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
