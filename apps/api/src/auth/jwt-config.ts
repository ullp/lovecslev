export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_DAYS = 30;

/**
 * Tajný klíč pro access tokeny. V produkci MUSÍ být nastaven `JWT_ACCESS_SECRET`
 * (spec §15.3), v developmentu padáme na zjevně vývojovou hodnotu.
 */
export function accessTokenSecret(): string {
  const secret = process.env.JWT_ACCESS_SECRET;
  if (secret !== undefined && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_ACCESS_SECRET musí být v produkci nastaven (min. 16 znaků)');
  }
  return 'dev-only-access-secret-change-me';
}
