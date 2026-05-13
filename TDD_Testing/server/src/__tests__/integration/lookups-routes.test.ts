import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app.js';

describe('lookups route', () => {
  it('GET /api/lookups returns all three lookup arrays', async () => {
    const app = createApp();
    const res = await request(app).get('/api/lookups');
    expect(res.status).toBe(200);
    expect(res.body.clientTypes).toContain('Business');
    expect(res.body.statuses).toContain('Active');
    expect(res.body.industries).toContain('Technology');
  });
});
