import { describe, it, expect } from 'vitest';
import { request } from './setup/test-app';
import { createRoom, createBed } from './setup/fixtures';

describe('GET /api/rooms', () => {
  it('returns empty list when no rooms', async () => {
    const res = await request.get('/api/rooms');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it('returns rooms with _count.beds', async () => {
    const room = await createRoom({ number: 'R101' });
    await createBed(room.id);
    await createBed(room.id, { number: `B${Date.now()}a` });

    const res = await request.get('/api/rooms');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]._count.beds).toBe(2);
  });

  it('supports search by room number', async () => {
    await createRoom({ number: 'ICU-01' });
    await createRoom({ number: 'WARD-05' });

    const res = await request.get('/api/rooms?search=ICU');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].number).toBe('ICU-01');
  });
});

describe('GET /api/rooms/:id', () => {
  it('returns room with beds array', async () => {
    const room = await createRoom({ number: 'R200', floor: 2, type: 'PRIVATE' });
    const bed = await createBed(room.id);

    const res = await request.get(`/api/rooms/${room.id}`);
    expect(res.status).toBe(200);
    expect(res.body.number).toBe('R200');
    expect(res.body.floor).toBe(2);
    expect(res.body.type).toBe('PRIVATE');
    expect(res.body.beds).toHaveLength(1);
    expect(res.body.beds[0].id).toBe(bed.id);
  });

  it('returns 404 for non-existent room', async () => {
    const res = await request.get('/api/rooms/99999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Room not found');
  });
});

describe('POST /api/rooms', () => {
  it('creates a room', async () => {
    const res = await request.post('/api/rooms').send({
      number: 'R301',
      floor: 3,
      type: 'ICU',
    });

    expect(res.status).toBe(201);
    expect(res.body.number).toBe('R301');
    expect(res.body.floor).toBe(3);
    expect(res.body.type).toBe('ICU');
    expect(res.body.status).toBe('AVAILABLE');
    expect(res.body.id).toBeDefined();
  });

  it('creates a room with optional status', async () => {
    const res = await request.post('/api/rooms').send({
      number: 'R302',
      floor: 1,
      type: 'WARD',
      status: 'MAINTENANCE',
    });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('MAINTENANCE');
  });

  it('returns 400 for invalid type', async () => {
    const res = await request.post('/api/rooms').send({
      number: 'R400',
      floor: 1,
      type: 'INVALID_TYPE',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  it('returns 400 for missing required fields', async () => {
    const res = await request.post('/api/rooms').send({ number: 'R401' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for floor out of range', async () => {
    const res = await request.post('/api/rooms').send({
      number: 'R402',
      floor: 51,
      type: 'WARD',
    });
    expect(res.status).toBe(400);
  });

  it('returns 409 for duplicate room number', async () => {
    await createRoom({ number: 'UNIQUE-RM' });
    const res = await request.post('/api/rooms').send({
      number: 'UNIQUE-RM',
      floor: 1,
      type: 'WARD',
    });
    expect(res.status).toBe(409);
  });
});

describe('PUT /api/rooms/:id', () => {
  it('updates an existing room', async () => {
    const room = await createRoom({ number: 'R500', floor: 1, type: 'WARD' });

    const res = await request.put(`/api/rooms/${room.id}`).send({
      number: 'R500-UPD',
      floor: 5,
      type: 'PRIVATE',
    });

    expect(res.status).toBe(200);
    expect(res.body.number).toBe('R500-UPD');
    expect(res.body.floor).toBe(5);
    expect(res.body.type).toBe('PRIVATE');
  });

  it('returns 404 for non-existent room', async () => {
    const res = await request.put('/api/rooms/99999').send({
      number: 'NOPE',
      floor: 1,
      type: 'WARD',
    });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/rooms/:id', () => {
  it('deletes an existing room', async () => {
    const room = await createRoom({ number: 'R600' });

    const res = await request.delete(`/api/rooms/${room.id}`);
    expect(res.status).toBe(204);

    const getRes = await request.get(`/api/rooms/${room.id}`);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 for non-existent room', async () => {
    const res = await request.delete('/api/rooms/99999');
    expect(res.status).toBe(404);
  });
});
