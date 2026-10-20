-- `subscriptions` je 1:1 s uživatelem (spec §9.9, D19)
CREATE UNIQUE INDEX "subscriptions_user_id_key" ON "subscriptions"("user_id");
