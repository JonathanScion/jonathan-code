import { describe, it, expect } from 'vitest';
import {
  ClientListSchema,
  ClientSchema,
  LookupsSchema,
  ValidationErrorSchema,
} from './schemas';

const BASE = process.env.API_BASE_URL ?? 'http://localhost:4000';

describe('API contract — /api/lookups', () => {
  it('response body matches LookupsSchema', async () => {
    const res = await fetch(`${BASE}/api/lookups`);
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = LookupsSchema.safeParse(body);
    if (!parsed.success) console.error(parsed.error.format());
    expect(parsed.success).toBe(true);
  });
});

describe('API contract — /api/clients', () => {
  it('GET returns an array of Client', async () => {
    const res = await fetch(`${BASE}/api/clients`);
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = ClientListSchema.safeParse(body);
    if (!parsed.success) console.error(parsed.error.format());
    expect(parsed.success).toBe(true);
  });

  it('GET /:id returns a single Client matching the schema', async () => {
    const listRes = await fetch(`${BASE}/api/clients`);
    const list = await listRes.json();
    expect(list.length).toBeGreaterThan(0);
    const res = await fetch(`${BASE}/api/clients/${list[0].id}`);
    expect(res.status).toBe(200);
    const body = await res.json();
    const parsed = ClientSchema.safeParse(body);
    if (!parsed.success) console.error(parsed.error.format());
    expect(parsed.success).toBe(true);
  });

  it('POST with invalid body returns 400 + ValidationErrorSchema', async () => {
    const res = await fetch(`${BASE}/api/clients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    const parsed = ValidationErrorSchema.safeParse(body);
    if (!parsed.success) console.error(parsed.error.format());
    expect(parsed.success).toBe(true);
  });
});
