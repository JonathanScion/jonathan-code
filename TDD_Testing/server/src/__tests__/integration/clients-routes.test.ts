import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../../app.js';

describe('clients routes', () => {
  let app: Express;

  beforeEach(() => {
    app = createApp(); // reseeds in-memory store
  });

  afterEach(() => {
    // store is module-level; next createApp() reseeds it
  });

  it('GET /api/clients returns the seeded list', async () => {
    const res = await request(app).get('/api/clients');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(4);
  });

  it('GET /api/clients?q= filters by name', async () => {
    const res = await request(app).get('/api/clients').query({ q: 'baker' });
    expect(res.status).toBe(200);
    expect(res.body.every((c: { lastName: string }) => c.lastName.toLowerCase().includes('baker'))).toBe(true);
  });

  it('GET /api/clients/:id returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/clients/does-not-exist');
    expect(res.status).toBe(404);
  });

  it('POST /api/clients returns 400 with field errors for invalid body', async () => {
    const res = await request(app)
      .post('/api/clients')
      .send({ firstName: '', clientType: 'Business' })
      .set('Content-Type', 'application/json');
    expect(res.status).toBe(400);
    expect(res.body.errors.firstName).toBeDefined();
    expect(res.body.errors.annualRevenue).toBeDefined();
    expect(res.body.errors.companyName).toBeDefined();
  });

  it('POST /api/clients creates a client and returns 201 with id', async () => {
    const res = await request(app)
      .post('/api/clients')
      .send({
        firstName: 'New',
        lastName: 'Person',
        email: 'new@example.com',
        phone: '+1-555-0100',
        companyName: '',
        clientType: 'Individual',
        status: 'Prospect',
        industry: 'Other',
        annualRevenue: null,
        notes: '',
      });
    expect(res.status).toBe(201);
    expect(res.body.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('PUT /api/clients/:id updates an existing client', async () => {
    const list = await request(app).get('/api/clients');
    const target = list.body[0];
    const res = await request(app)
      .put(`/api/clients/${target.id}`)
      .send({ ...target, notes: 'updated' });
    expect(res.status).toBe(200);
    expect(res.body.notes).toBe('updated');
  });

  it('DELETE /api/clients/:id removes a client', async () => {
    const list = await request(app).get('/api/clients');
    const target = list.body[0];
    const del = await request(app).delete(`/api/clients/${target.id}`);
    expect(del.status).toBe(204);
    const after = await request(app).get(`/api/clients/${target.id}`);
    expect(after.status).toBe(404);
  });
});
