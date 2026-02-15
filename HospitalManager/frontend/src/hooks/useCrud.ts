import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { PaginatedResponse } from '../types';

interface UseCrudOptions {
  endpoint: string;
  queryKey: string;
}

export function useCrud<T extends { id: number }>({ endpoint, queryKey }: UseCrudOptions) {
  const queryClient = useQueryClient();

  const useList = (params?: Record<string, string | number | undefined>) => {
    const filteredParams = Object.fromEntries(
      Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== '')
    );
    return useQuery<PaginatedResponse<T>>({
      queryKey: [queryKey, filteredParams],
      queryFn: () => api.get(endpoint, { params: filteredParams }).then(r => r.data),
    });
  };

  const useGet = (id: number | null) =>
    useQuery<T>({
      queryKey: [queryKey, id],
      queryFn: () => api.get(`${endpoint}/${id}`).then(r => r.data),
      enabled: id !== null,
    });

  const useCreate = () =>
    useMutation({
      mutationFn: (data: Partial<T>) => api.post(endpoint, data).then(r => r.data),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
    });

  const useUpdate = () =>
    useMutation({
      mutationFn: ({ id, data }: { id: number; data: Partial<T> }) =>
        api.put(`${endpoint}/${id}`, data).then(r => r.data),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
    });

  const useDelete = () =>
    useMutation({
      mutationFn: (id: number) => api.delete(`${endpoint}/${id}`),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
    });

  const useUpdateStatus = () =>
    useMutation({
      mutationFn: ({ id, status }: { id: number; status: string }) =>
        api.patch(`${endpoint}/${id}/status`, { status }).then(r => r.data),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: [queryKey] }),
    });

  return { useList, useGet, useCreate, useUpdate, useDelete, useUpdateStatus };
}
