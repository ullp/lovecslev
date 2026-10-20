-- P2: pamatovat si cenu posledního upozornění (nové minimum, spec §6 P2)
ALTER TABLE "price_alerts"
  ADD COLUMN "last_notified_unit_price_minor" INTEGER;
