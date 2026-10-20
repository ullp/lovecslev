// Testy nesmí nikdy sahat na reálnou DB (spec §16). PrismaClient vyžaduje URL
// už při konstrukci, proto se doplňuje jen dummy hodnota.
process.env.DATABASE_URL ??= 'postgresql://slevari:slevari@localhost:5432/slevari_test';
process.env.SEARCH_DRIVER ??= 'postgres';
