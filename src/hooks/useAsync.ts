"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchWithCache, invalidateCache } from "@/lib/cache";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook de dados sem cache (comportamento original).
 * Use para mutações ou dados que precisam ser sempre frescos.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });
  const seq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fnRef = useCallback(fn, deps);

  const load = useCallback(async () => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await fnRef();
      if (seq.current === id) setState({ data, loading: false, error: null });
      return data;
    } catch (err) {
      if (seq.current === id) {
        setState({
          data: null,
          loading: false,
          error: err instanceof Error ? err.message : "Algo deu errado.",
        });
      }
      return undefined;
    }
  }, [fnRef]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    ...state,
    reload: load,
    setData: (data: T) => setState({ data, loading: false, error: null }),
  };
}

/**
 * Hook de dados COM cache.
 * - Na primeira visita, busca dados e cacheia.
 * - Ao navegar de volta, retorna cache instantaneamente.
 * - Revalida em background se stale (> ttl ms).
 * - invalidateKey: prefixo para invalidar o cache após mutations.
 */
export function useCachedAsync<T>(
  fn: () => Promise<T>,
  deps: unknown[],
  cacheKey: string,
  ttl = 30_000,
  invalidateKey?: string,
) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null });
  const seq = useRef(0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const fnRef = useCallback(fn, deps);

  const load = useCallback(async (forceFresh = false) => {
    const id = ++seq.current;
    setState((s) => ({ ...s, loading: s.data === null, error: null }));
    try {
      const data = forceFresh
        ? await fnRef().then((d) => { fetchWithCache(cacheKey, () => Promise.resolve(d), ttl); return d; })
        : await fetchWithCache(cacheKey, fnRef, ttl);
      if (seq.current === id) setState({ data, loading: false, error: null });
      return data;
    } catch (err) {
      if (seq.current === id) {
        setState({
          data: null,
          loading: false,
          error: err instanceof Error ? err.message : "Algo deu errado.",
        });
      }
      return undefined;
    }
  }, [fnRef, cacheKey, ttl]);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(() => {
    if (invalidateKey) invalidateCache(invalidateKey);
    return load(true);
  }, [load, invalidateKey]);

  return {
    ...state,
    reload,
    setData: (data: T) => setState({ data, loading: false, error: null }),
  };
}
