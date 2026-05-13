import { randomUUID } from 'node:crypto';
import type { Client, ClientInput } from '../types.js';

const clients = new Map<string, Client>();

export function listAll(): Client[] {
  return [...clients.values()].sort((a, b) => a.lastName.localeCompare(b.lastName));
}

export function getById(id: string): Client | undefined {
  return clients.get(id);
}

export function create(input: ClientInput): Client {
  const now = new Date().toISOString();
  const client: Client = {
    id: randomUUID(),
    ...input,
    createdAt: now,
    updatedAt: now,
  };
  clients.set(client.id, client);
  return client;
}

export function update(id: string, input: ClientInput): Client | undefined {
  const existing = clients.get(id);
  if (!existing) return undefined;
  const updated: Client = {
    ...existing,
    ...input,
    id: existing.id,
    createdAt: existing.createdAt,
    updatedAt: new Date().toISOString(),
  };
  clients.set(id, updated);
  return updated;
}

export function remove(id: string): boolean {
  return clients.delete(id);
}

export function seed(seedClients: Client[]): void {
  clients.clear();
  for (const client of seedClients) clients.set(client.id, client);
}

export function clear(): void {
  clients.clear();
}

export function count(): number {
  return clients.size;
}
