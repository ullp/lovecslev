// Testy nesmí nikdy sahat na reálnou DB (spec §16). PrismaClient vyžaduje URL
// už při konstrukci, proto se doplňuje jen dummy hodnota.
process.env.DATABASE_URL ??= 'postgresql://lovecslev:lovecslev@localhost:5432/lovecslev_test';
process.env.SEARCH_DRIVER ??= 'postgres';
