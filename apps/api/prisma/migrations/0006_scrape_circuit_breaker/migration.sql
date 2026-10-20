-- Circuit breaker scrapingu per řetězec (spec §14.5)
ALTER TABLE "chains"
  ADD COLUMN "scrape_failures" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "scrape_paused_until" TIMESTAMP(3);
