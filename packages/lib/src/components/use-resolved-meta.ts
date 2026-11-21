import { useEffect, useState } from 'react';
import type { FormSchema } from '../core/types';

export type AsyncMeta = FormSchema | Promise<FormSchema>;

export interface ResolvedMeta {
  meta: FormSchema | undefined;
  error: unknown;
  pending: boolean;
}

/** Resolve sync-or-promise meta; last prop wins, stale resolves are ignored. */
export function useResolvedMeta(meta: AsyncMeta): ResolvedMeta {
  const [state, setState] = useState<ResolvedMeta>(() =>
    isPromise(meta)
      ? { meta: undefined, error: undefined, pending: true }
      : { meta, error: undefined, pending: false },
  );
  useEffect(() => {
    if (!isPromise(meta)) {
      setState({ meta, error: undefined, pending: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, pending: true, error: undefined }));
    meta.then(
      (resolved) => {
        if (!cancelled) setState({ meta: resolved, error: undefined, pending: false });
      },
      (error) => {
        if (!cancelled) setState({ meta: undefined, error, pending: false });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [meta]);
  return state;
}

function isPromise(value: AsyncMeta): value is Promise<FormSchema> {
  return typeof (value as Promise<FormSchema>)?.then === 'function';
}
