import type { Client, ClientInput, Lookups, ValidationErrorResponse } from '../types';

const BASE = '/api';

export class ApiError extends Error {
  status: number;
  validation?: ValidationErrorResponse['errors'];

  constructor(message: string, status: number, validation?: ValidationErrorResponse['errors']) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.validation = validation;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const validation =
      body && typeof body === 'object' && 'errors' in body ? (body as ValidationErrorResponse).errors : undefined;
    const message =
      (body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : null) ?? `Request failed with ${res.status}`;
    throw new ApiError(message, res.status, validation);
  }
  return body as T;
}

export interface ListParams {
  q?: string;
  sort?: 'lastName' | 'createdAt' | 'annualRevenue' | 'status';
  dir?: 'asc' | 'desc';
}

export function listClients(params: ListParams = {}): Promise<Client[]> {
  const qs = new URLSearchParams();
  if (params.q) qs.set('q', params.q);
  if (params.sort) qs.set('sort', params.sort);
  if (params.dir) qs.set('dir', params.dir);
  const query = qs.toString();
  return request<Client[]>(`/clients${query ? `?${query}` : ''}`);
}

export function getClient(id: string): Promise<Client> {
  return request<Client>(`/clients/${encodeURIComponent(id)}`);
}

export function createClient(input: ClientInput): Promise<Client> {
  return request<Client>('/clients', { method: 'POST', body: JSON.stringify(input) });
}

export function updateClient(id: string, input: ClientInput): Promise<Client> {
  return request<Client>(`/clients/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function deleteClient(id: string): Promise<void> {
  return request<void>(`/clients/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function getLookups(): Promise<Lookups> {
  return request<Lookups>('/lookups');
}
