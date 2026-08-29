/**
 * Cache simples em memória com TTL para dados da API.
 * Chave = string serializada dos arguments da query.
 * TTL padrão = 30s (dados relativamente estáveis como listas).
 */

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const store = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL = 30_000; // 30 segundos

export function cacheKey(...parts: unknown[]): string {
  return parts.map((p) => (typeof p === "string" ? p : JSON.stringify(p))).join("|");
}

export function getCached<T>(key: string, ttl = DEFAULT_TTL): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > ttl) {
    store.delete(key);
    return undefined;
  }
  return entry.data as T;
}

export function setCache<T>(key: string, data: T): void {
  store.set(key, { data, ts: Date.now() });
}

/**
 * Busca com cache: retorna o cache se disponível, busca em background
 * se stale, e retorna o dado imediatamente.
 */
export async function fetchWithCache<T>(
  key: string,
  fn: () => Promise<T>,
  ttl = DEFAULT_TTL,
): Promise<T> {
  const cached = getCached<T>(key, ttl);
  if (cached !== undefined) return cached;

  // Se já tem uma requisição em andamento, espera ela
  const existing = inflight.get(key);
  if (existing) return existing as Promise<T>;

  const promise = fn().then((data) => {
    setCache(key, data);
    inflight.delete(key);
    return data;
  }).catch((err) => {
    inflight.delete(key);
    throw err;
  });

  inflight.set(key, promise);
  return promise;
}

/** Remove entrada do cache (por key exata ou prefixo). */
export function invalidateCache(keyPrefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(keyPrefix)) store.delete(key);
  }
}

/** Limpa todo o cache (útil após mutations). */
export function clearCache(): void {
  store.clear();
}
