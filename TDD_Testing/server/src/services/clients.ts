import type { Client } from '../types.js';

export type SortField = 'lastName' | 'createdAt' | 'annualRevenue' | 'status';
export type SortDirection = 'asc' | 'desc';

export function filterClients(clients: Client[], query: string): Client[] {
  const q = query.trim().toLowerCase();
  if (!q) return clients;
  return clients.filter((c) => {
    const haystack = [
      c.firstName,
      c.lastName,
      c.email,
      c.companyName,
      c.industry,
      c.status,
      c.clientType,
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
}

export function sortClients(
  clients: Client[],
  field: SortField,
  direction: SortDirection,
): Client[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...clients].sort((a, b) => {
    const av = a[field];
    const bv = b[field];

    if (av == null && bv == null) return 0;
    if (av == null) return 1 * factor;
    if (bv == null) return -1 * factor;

    if (typeof av === 'number' && typeof bv === 'number') {
      return (av - bv) * factor;
    }
    return String(av).localeCompare(String(bv)) * factor;
  });
}

export function accountAgeDays(client: Pick<Client, 'createdAt'>, now: Date): number {
  const created = new Date(client.createdAt).getTime();
  const ms = now.getTime() - created;
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}
