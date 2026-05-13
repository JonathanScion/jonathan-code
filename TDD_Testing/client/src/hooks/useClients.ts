import { useCallback, useEffect, useState } from 'react';
import { listClients, type ListParams } from '../api/client';
import type { Client } from '../types';

interface State {
  clients: Client[];
  loading: boolean;
  error: string | null;
}

export function useClients(params: ListParams) {
  const [state, setState] = useState<State>({ clients: [], loading: true, error: null });

  const refresh = useCallback(() => {
    setState((s) => ({ ...s, loading: true, error: null }));
    return listClients(params)
      .then((clients) => setState({ clients, loading: false, error: null }))
      .catch((err: Error) => setState({ clients: [], loading: false, error: err.message }));
  }, [params.q, params.sort, params.dir]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { ...state, refresh };
}
