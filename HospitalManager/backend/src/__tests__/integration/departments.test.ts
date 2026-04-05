import { describe, it, expect } from 'vitest';
import { request } from './setup/test-app';
import { createDepartment } from './setup/fixtures';

describe('GET /api/departments', () => {
  it('returns empty paginated list when no departments', async () => {
    const res = await request.get('/api/departments');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination).toMatchObject({
      page: 1,
      pageSize: 25,
      total: 0,
      totalPages: 0,
    });
  });

  it('returns departments with pagination', async () => {
    await createDepartment({ name: 'Cardiology' });
    await createDepartment({ name: 'Neurology' });

    const res = await request.get('/api/departments');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);
  });

  it('supports search query', async () => {
    await createDepartment({ name: 'Cardiology' });
    await createDepartment({ name: 'Neurology' });

    const res = await request.get('/api/departments?search=cardio');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Cardiology');
  });

  it('supports pagination parameters', async () => {
    for (let i = 0; i < 5; i++) {
      await createDepartment({ name: `Dept ${i}` });
    }

    const res = await request.get('/api/departments?page=2&pageSize=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination).toMatchObject({ page: 2, pageSize: 2, total: 5, totalPages: 3 });
  });
});

describe('GET /api/departments/:id', () => {
  it('returns a department by ID', async () => {
    const dept = await createDepartment({ name: 'Radiology', description: 'Imaging' });

    const res = await request.get(`/api/departments/${dept.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Radiology');
    expect(res.body.description).toBe('Imaging');
  });

  it('returns 404 for non-existent department', async () => {
    const res = await request.get('/api/departments/99999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Department not found');
  });
});

describe('POST /api/departments', () => {
  it('creates a new department', async () => {
    const res = await request
      .post('/api/departments')
      .send({ name: 'Oncology', description: 'Cancer care', phone: '555-0105' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Oncology');
    expect(res.body.id).toBeDefined();
    expect(res.body.createdAt).toBeDefined();
  });

  it('creates department with only required fields', async () => {
    const res = await request.post('/api/departments').send({ name: 'Minimal' });
    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Minimal');
  });

  it('returns 400 for empty name', async () => {
    const res = await request.post('/api/departments').send({ name: '' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  it('returns 400 for missing name', async () => {
    const res = await request.post('/api/departments').send({});
    expect(res.status).toBe(400);
  });

  it('returns 409 for duplicate name', async () => {
    await createDepartment({ name: 'Unique Dept' });
    const res = await request.post('/api/departments').send({ name: 'Unique Dept' });
    expect(res.status).toBe(409);
  });
});

describe('PUT /api/departments/:id', () => {
  it('updates an existing department', async () => {
    const dept = await createDepartment({ name: 'Old Name' });

    const res = await request
      .put(`/api/departments/${dept.id}`)
      .send({ name: 'New Name', description: 'Updated' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('New Name');
    expect(res.body.description).toBe('Updated');
  });

  it('returns 404 for non-existent department', async () => {
    const res = await request.put('/api/departments/99999').send({ name: 'Test' });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/departments/:id', () => {
  it('deletes an existing department', async () => {
    const dept = await createDepartment({ name: 'To Delete' });

    const res = await request.delete(`/api/departments/${dept.id}`);
    expect(res.status).toBe(204);

    const getRes = await request.get(`/api/departments/${dept.id}`);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 for non-existent department', async () => {
    const res = await request.delete('/api/departments/99999');
    expect(res.status).toBe(404);
  });
});
