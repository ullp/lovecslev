import 'reflect-metadata';
import { createApp } from './app.factory';

async function bootstrap(): Promise<void> {
  const app = await createApp();
  const port = Number(process.env.PORT ?? 3000);

  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`slevari-api listening on http://localhost:${port} (GET /health)`);
}

void bootstrap();
