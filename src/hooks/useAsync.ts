"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

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
