import { load } from 'cheerio';
import type { LeafletImportDto, LeafletProductDto, PricingMode, PackageUnit } from '@lovecslev/shared';
import type { LeafletSourceAdapter, RawSnapshot } from '../scraping.types';

export const LIDL_USER_AGENT =
  'LovecSlevBot/0.1 (+https://lovecslev.cz/bot; kontakt: data@lovecslev.cz)';

const toNumber = (value: string | undefined): number | null => {
  if (value === undefined) return null;
  const normalized = value.replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

/**
 * Parser Lidl HTML (spec §14.5). Čte data-atributy z archivované struktury;
 * při změně reálného HTML se MUSÍ aktualizovat tento parser i snapshot v testech.
 */
export function parseLidlHtml(snapshot: RawSnapshot): LeafletImportDto {
  const $ = load(snapshot.body);
  const leaflet = $('.leaflet').first();

  const validFrom = leaflet.attr('data-valid-from') ?? '';
  const validTo = leaflet.attr('data-valid-to') ?? '';

  const products: LeafletProductDto[] = [];

  leaflet.find('.product').each((_index, element) => {
    const node = $(element);
    const name = node.attr('data-name')?.trim();
    const price = toNumber(node.attr('data-price'));
    const amount = toNumber(node.attr('data-amount'));
    const unit = node.attr('data-unit') as PackageUnit | undefined;

    if (name === undefined || name === '' || price === null || amount === null || unit === undefined) {
      return; // neúplný záznam — validator by ho stejně odmítl, raději přeskočit
    }

    const pricing = node.attr('data-pricing') as PricingMode | undefined;
    const brand = node.attr('data-brand')?.trim();
    const category = node.attr('data-category')?.trim();
    const regular = toNumber(node.attr('data-regular-price'));

    products.push({
      name,
      ...(brand === undefined || brand === '' ? {} : { brand }),
      price,
      ...(regular === null ? {} : { regularPrice: regular }),
      packageAmount: amount,
      packageUnit: unit,
      ...(category === undefined || category === '' ? {} : { category }),
      ...(pricing === undefined ? {} : { pricing }),
    });
  });

  return {
    chain: snapshot.chainCode,
    title: 'Lidl — týdenní akce',
    validFrom,
    validTo,
    sourceUrl: snapshot.sourceUrl,
    products,
  };
}

/** HTTP adaptér (produkce). URL MUSÍ být nastavena; bez právního schválení se vůbec nespustí. */
export class LidlHtmlAdapter implements LeafletSourceAdapter {
  readonly chainCode = 'LIDL';

  constructor(
    private readonly url: string | undefined = process.env.SCRAPE_LIDL_URL,
    private readonly timeoutMs = 10_000,
  ) {}

  async fetch(period: { validFrom: string; validTo: string }): Promise<RawSnapshot> {
    void period;
    if (this.url === undefined || this.url === '') {
      throw new Error('SCRAPE_LIDL_URL není nastavena — zdroj dat musí být licencován (Q1/D16)');
    }

    const response = await fetch(this.url, {
      headers: {
        'user-agent': LIDL_USER_AGENT,
        accept: 'text/html',
      },
      signal: AbortSignal.timeout(this.timeoutMs),
    });

    if (!response.ok) {
      throw new Error(`Zdroj odpověděl ${response.status}`);
    }

    return {
      chainCode: this.chainCode,
      contentType: 'text/html',
      body: await response.text(),
      sourceUrl: this.url,
      fetchedAt: new Date(),
    };
  }

  parse(snapshot: RawSnapshot): LeafletImportDto {
    return parseLidlHtml(snapshot);
  }
}

/**
 * Offline adaptér pro demo/CI: čte archivovaný snapshot z disku.
 * Umožňuje ověřit celou pipeline bez síťového volání.
 */
export class FileFixtureAdapter implements LeafletSourceAdapter {
  constructor(
    readonly chainCode: string,
    private readonly dir: string = process.env.SCRAPE_FIXTURE_DIR ?? 'test/fixtures/scrape',
  ) {}

  async fetch(period: { validFrom: string; validTo: string }): Promise<RawSnapshot> {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const file = join(this.dir, `${this.chainCode.toLowerCase()}-${period.validFrom}.html`);

    return {
      chainCode: this.chainCode,
      contentType: 'text/html',
      body: await readFile(file, 'utf8'),
      sourceUrl: `file://${file}`,
      fetchedAt: new Date(),
    };
  }

  parse(snapshot: RawSnapshot): LeafletImportDto {
    return parseLidlHtml(snapshot);
  }
}
