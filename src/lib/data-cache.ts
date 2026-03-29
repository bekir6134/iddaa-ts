import fs from 'fs/promises';
import path from 'path';
import type { AppCache, CacheMeta, StorageAdapter } from '@/types/cache';

// ─── File System Adapter ──────────────────────────────────────────────────────

class FileSystemAdapter implements StorageAdapter {
  private baseDir: string;

  constructor(baseDir: string) {
    this.baseDir = baseDir;
  }

  private filePath(key: string): string {
    return path.join(this.baseDir, `${key}.json`);
  }

  private binaryPath(key: string): string {
    return path.join(this.baseDir, '..', 'excel', `${key}.xlsx`);
  }

  async read(key: string): Promise<string | null> {
    try {
      return await fs.readFile(this.filePath(key), 'utf-8');
    } catch {
      return null;
    }
  }

  async write(key: string, value: string): Promise<void> {
    await fs.mkdir(this.baseDir, { recursive: true });
    await fs.writeFile(this.filePath(key), value, 'utf-8');
  }

  async readBinary(key: string): Promise<Buffer | null> {
    try {
      const data = await fs.readFile(this.binaryPath(key));
      return Buffer.from(data);
    } catch {
      return null;
    }
  }

  async writeBinary(key: string, buffer: Buffer): Promise<void> {
    const excelDir = path.join(this.baseDir, '..', 'excel');
    await fs.mkdir(excelDir, { recursive: true });
    await fs.writeFile(this.binaryPath(key), buffer);
  }
}

// ─── Singleton Adapter ────────────────────────────────────────────────────────

function getAdapter(): StorageAdapter {
  const cacheDir = process.env.CACHE_DIR ?? path.join(process.cwd(), 'data', 'cache');
  return new FileSystemAdapter(cacheDir);
}

// ─── In-Memory Cache ──────────────────────────────────────────────────────────

let memoryCache: AppCache | null = null;

function emptyCache(): AppCache {
  return {
    meta: {
      lastUpdated: '',
      nextUpdate: '',
      requestsUsed: 0,
      requestBudget: 100,
      leagues: [],
      fixtureCount: 0,
      status: 'stale',
    },
    fixtures: { today: [], tomorrow: [], byLeague: {}, byDate: {} },
    odds: { byFixture: {} },
    predictions: { byFixture: {} },
    injuries: { byLeague: {}, byTeam: {} },
    standings: { byLeague: {} },
    h2h: { byFixturePair: {} },
    teamStats: { byTeam: {} },
  };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function loadCache(): Promise<AppCache> {
  const adapter = getAdapter();
  const keys: (keyof Omit<AppCache, 'meta'>)[] = [
    'fixtures', 'odds', 'predictions', 'injuries', 'standings', 'h2h', 'teamStats',
  ];

  const cache = emptyCache();

  const metaRaw = await adapter.read('meta');
  if (metaRaw) {
    try { cache.meta = JSON.parse(metaRaw); } catch { /* ignore */ }
  }

  await Promise.all(
    keys.map(async (key) => {
      const raw = await adapter.read(key);
      if (raw) {
        try { (cache as unknown as Record<string, unknown>)[key] = JSON.parse(raw); } catch { /* ignore */ }
      }
    })
  );

  memoryCache = cache;
  return cache;
}

export async function getCache(): Promise<AppCache> {
  if (memoryCache) return memoryCache;
  return loadCache();
}

export function invalidateCache(): void {
  memoryCache = null;
}

export async function saveCache<K extends keyof AppCache>(
  key: K,
  data: AppCache[K]
): Promise<void> {
  const adapter = getAdapter();
  await adapter.write(key as string, JSON.stringify(data, null, 2));
  if (memoryCache) {
    (memoryCache as unknown as Record<string, unknown>)[key] = data;
  }
}

export async function getCacheMeta(): Promise<CacheMeta> {
  const cache = await getCache();
  return cache.meta;
}

export async function saveExcel(buffer: Buffer): Promise<void> {
  const adapter = getAdapter();
  await adapter.writeBinary('iddaa-analiz', buffer);
}

export async function readExcel(): Promise<Buffer | null> {
  const adapter = getAdapter();
  return adapter.readBinary('iddaa-analiz');
}
