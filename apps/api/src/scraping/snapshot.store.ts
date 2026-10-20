import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Injectable } from '@nestjs/common';
import type { RawSnapshot, SnapshotStore } from './scraping.types';

const EXTENSION_BY_TYPE: Record<RawSnapshot['contentType'], string> = {
  'text/html': 'html',
  'application/pdf': 'pdf',
  'application/json': 'json',
};

/** Ukládá raw snapshoty na disk (spec §14.5) — možnost re-parsování bez refetchování. */
@Injectable()
export class FileSnapshotStore implements SnapshotStore {
  constructor(private readonly rootDir = process.env.SNAPSHOT_DIR ?? 'storage/raw') {}

  async save(snapshot: RawSnapshot, validFrom: string): Promise<{ path: string; sha256: string }> {
    const sha256 = createHash('sha256').update(snapshot.body, 'utf8').digest('hex');
    const extension = EXTENSION_BY_TYPE[snapshot.contentType];
    const relative = join(snapshot.chainCode.toLowerCase(), validFrom, `${sha256}.${extension}`);

    const absolute = join(this.rootDir, relative);
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, snapshot.body, 'utf8');

    return { path: relative, sha256 };
  }
}
