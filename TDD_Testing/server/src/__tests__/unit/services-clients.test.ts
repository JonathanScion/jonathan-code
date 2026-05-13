import { describe, it, expect } from 'vitest';
import { accountAgeDays, filterClients, sortClients } from '../../services/clients.js';
import type { Client } from '../../types.js';

const sample: Client[] = [
  {
    id: '1',
    firstName: 'Alice',
    lastName: 'Anderson',
    email: 'alice@example.com',
    phone: '555-0101',
    companyName: 'Anderson Co',
    clientType: 'Business',
    status: 'Active',
    industry: 'Finance',
    annualRevenue: 250000,
    notes: '',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  {
    id: '2',
    firstName: 'Bob',
    lastName: 'Baker',
    email: 'bob@example.com',
    phone: '555-0102',
    companyName: '',
    clientType: 'Individual',
    status: 'Inactive',
    industry: 'Other',
    annualRevenue: null,
    notes: '',
    createdAt: '2025-03-01T00:00:00.000Z',
    updatedAt: '2025-03-01T00:00:00.000Z',
  },
];

describe('filterClients', () => {
  it('returns everything for empty query', () => {
    expect(filterClients(sample, '')).toHaveLength(2);
  });

  it('matches on last name case-insensitively', () => {
    expect(filterClients(sample, 'BAKER')).toHaveLength(1);
  });

  it('matches on company name', () => {
    expect(filterClients(sample, 'anderson co')).toHaveLength(1);
  });

  it('returns empty array when nothing matches', () => {
    expect(filterClients(sample, 'zzz')).toEqual([]);
  });
});

describe('sortClients', () => {
  it('sorts by lastName ascending', () => {
    const result = sortClients(sample, 'lastName', 'asc');
    expect(result.map((c) => c.lastName)).toEqual(['Anderson', 'Baker']);
  });

  it('sorts by lastName descending', () => {
    const result = sortClients(sample, 'lastName', 'desc');
    expect(result.map((c) => c.lastName)).toEqual(['Baker', 'Anderson']);
  });

  it('sorts numeric annualRevenue with nulls last', () => {
    const result = sortClients(sample, 'annualRevenue', 'asc');
    expect(result[0].id).toBe('1');
    expect(result[1].id).toBe('2');
  });

  it('does not mutate the input array', () => {
    const copy = [...sample];
    sortClients(sample, 'lastName', 'desc');
    expect(sample).toEqual(copy);
  });
});

describe('accountAgeDays', () => {
  it('is deterministic with injected now', () => {
    const c = { createdAt: '2025-01-01T00:00:00.000Z' };
    expect(accountAgeDays(c, new Date('2025-01-11T00:00:00.000Z'))).toBe(10);
  });

  it('returns 0 when now is before createdAt', () => {
    const c = { createdAt: '2025-06-01T00:00:00.000Z' };
    expect(accountAgeDays(c, new Date('2025-01-01T00:00:00.000Z'))).toBe(0);
  });
});
