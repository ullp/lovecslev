/**
 * Minimální localStorage pro testy auth store (node prostředí).
 * Registruje se jen při importu tohoto souboru.
 */
class MemoryStorage implements Storage {
  private readonly data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  clear(): void {
    this.data.clear();
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.data.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

export function installMemoryStorage(): Storage {
  const storage = new MemoryStorage();
  globalThis.localStorage = storage;
  globalThis.window = { localStorage: storage } as unknown as Window & typeof globalThis;
  return storage;
}

export function uninstallStorage(): void {
  // @ts-expect-error – úklid testovacího prostředí
  delete globalThis.window;
  // @ts-expect-error – úklid testovacího prostředí
  delete globalThis.localStorage;
}
