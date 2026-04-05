import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useCrud } from '../../../hooks/useCrud';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

interface TestEntity {
  id: number;
  name: string;
}

describe('useCrud', () => {
  it('returns all hook functions', () => {
    const { result } = renderHook(
      () => useCrud<TestEntity>({ endpoint: '/departments', queryKey: 'departments' }),
      { wrapper: createWrapper() },
    );

    expect(result.current.useList).toBeDefined();
    expect(result.current.useGet).toBeDefined();
    expect(result.current.useCreate).toBeDefined();
    expect(result.current.useUpdate).toBeDefined();
    expect(result.current.useDelete).toBeDefined();
    expect(result.current.useUpdateStatus).toBeDefined();
  });

  it('useList fetches paginated data', async () => {
    const { result } = renderHook(
      () => {
        const crud = useCrud<TestEntity>({ endpoint: '/departments', queryKey: 'departments' });
        return crud.useList();
      },
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data?.data).toBeDefined();
    expect(result.current.data?.pagination).toBeDefined();
  });

  it('useList filters out undefined and empty params', async () => {
    const { result } = renderHook(
      () => {
        const crud = useCrud<TestEntity>({ endpoint: '/departments', queryKey: 'departments' });
        return crud.useList({ search: '', page: undefined, pageSize: '25' });
      },
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });

  it('useGet does not fetch when id is null', () => {
    const { result } = renderHook(
      () => {
        const crud = useCrud<TestEntity>({ endpoint: '/departments', queryKey: 'departments' });
        return crud.useGet(null);
      },
      { wrapper: createWrapper() },
    );

    expect(result.current.isFetching).toBe(false);
  });

  it('useGet fetches when id is provided', async () => {
    const { result } = renderHook(
      () => {
        const crud = useCrud<TestEntity>({ endpoint: '/departments', queryKey: 'departments' });
        return crud.useGet(1);
      },
      { wrapper: createWrapper() },
    );

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
