import { Router } from 'express';
import * as store from '../data/store.js';
import { filterClients, sortClients, type SortDirection, type SortField } from '../services/clients.js';
import { hasErrors, validateClient } from '../validation/client.js';
import type { ClientInput } from '../types.js';

const SORT_FIELDS = new Set<SortField>(['lastName', 'createdAt', 'annualRevenue', 'status']);
const SORT_DIRECTIONS = new Set<SortDirection>(['asc', 'desc']);

export const clientsRouter = Router();

clientsRouter.get('/', (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q : '';
  const sortFieldRaw = typeof req.query.sort === 'string' ? req.query.sort : 'lastName';
  const sortDirRaw = typeof req.query.dir === 'string' ? req.query.dir : 'asc';
  const sortField: SortField = SORT_FIELDS.has(sortFieldRaw as SortField)
    ? (sortFieldRaw as SortField)
    : 'lastName';
  const sortDir: SortDirection = SORT_DIRECTIONS.has(sortDirRaw as SortDirection)
    ? (sortDirRaw as SortDirection)
    : 'asc';

  const all = store.listAll();
  const filtered = filterClients(all, q);
  const sorted = sortClients(filtered, sortField, sortDir);
  res.json(sorted);
});

clientsRouter.get('/:id', (req, res) => {
  const client = store.getById(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  res.json(client);
});

clientsRouter.post('/', (req, res) => {
  const input = normalizeInput(req.body);
  const errors = validateClient(input);
  if (hasErrors(errors)) return res.status(400).json({ errors });
  const created = store.create(input as ClientInput);
  res.status(201).json(created);
});

clientsRouter.put('/:id', (req, res) => {
  const input = normalizeInput(req.body);
  const errors = validateClient(input);
  if (hasErrors(errors)) return res.status(400).json({ errors });
  const updated = store.update(req.params.id, input as ClientInput);
  if (!updated) return res.status(404).json({ error: 'Client not found' });
  res.json(updated);
});

clientsRouter.delete('/:id', (req, res) => {
  const ok = store.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Client not found' });
  res.status(204).end();
});

function normalizeInput(body: unknown): Partial<ClientInput> {
  if (!body || typeof body !== 'object') return {};
  const b = body as Record<string, unknown>;
  const revenue =
    b.annualRevenue === '' || b.annualRevenue == null
      ? null
      : Number(b.annualRevenue);
  return {
    firstName: str(b.firstName),
    lastName: str(b.lastName),
    email: str(b.email),
    phone: str(b.phone),
    companyName: str(b.companyName),
    clientType: b.clientType as ClientInput['clientType'],
    status: b.status as ClientInput['status'],
    industry: b.industry as ClientInput['industry'],
    annualRevenue: revenue,
    notes: str(b.notes),
  };
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}
