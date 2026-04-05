import { describe, it, expect } from 'vitest';
import { request } from './setup/test-app';
import { createMedication } from './setup/fixtures';

describe('GET /api/medications', () => {
  it('returns empty list when no medications', async () => {
    const res = await request.get('/api/medications');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it('returns medications with pagination', async () => {
    await createMedication({ name: 'Aspirin' });
    await createMedication({ name: 'Ibuprofen' });

    const res = await request.get('/api/medications');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.pagination.total).toBe(2);
  });

  it('supports search by name', async () => {
    await createMedication({ name: 'Amoxicillin' });
    await createMedication({ name: 'Lisinopril' });

    const res = await request.get('/api/medications?search=amox');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Amoxicillin');
  });
});

describe('GET /api/medications/:id', () => {
  it('returns a medication by ID', async () => {
    const med = await createMedication({
      name: 'Metformin',
      genericName: 'Metformin HCl',
      dosageForm: 'TABLET',
      strength: '500mg',
      price: 5.99,
    });

    const res = await request.get(`/api/medications/${med.id}`);
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Metformin');
    expect(res.body.genericName).toBe('Metformin HCl');
    expect(res.body.strength).toBe('500mg');
  });

  it('returns 404 for non-existent medication', async () => {
    const res = await request.get('/api/medications/99999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Medication not found');
  });
});

describe('POST /api/medications', () => {
  it('creates a medication with all fields', async () => {
    const res = await request.post('/api/medications').send({
      name: 'Omeprazole',
      genericName: 'Omeprazole Magnesium',
      manufacturer: 'PharmaCo',
      dosageForm: 'CAPSULE',
      strength: '20mg',
      price: 12.50,
      requiresRx: true,
    });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Omeprazole');
    expect(res.body.dosageForm).toBe('CAPSULE');
    expect(res.body.manufacturer).toBe('PharmaCo');
    expect(res.body.requiresRx).toBe(true);
    expect(res.body.id).toBeDefined();
  });

  it('creates a medication with only required fields', async () => {
    const res = await request.post('/api/medications').send({
      name: 'Simple Med',
      dosageForm: 'SYRUP',
      strength: '100ml',
      price: 3.99,
    });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Simple Med');
    expect(res.body.dosageForm).toBe('SYRUP');
  });

  it('returns 400 for invalid dosageForm enum', async () => {
    const res = await request.post('/api/medications').send({
      name: 'Bad Med',
      dosageForm: 'POWDER',
      strength: '10g',
      price: 1.00,
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  it('returns 400 for negative price', async () => {
    const res = await request.post('/api/medications').send({
      name: 'Neg Price',
      dosageForm: 'TABLET',
      strength: '10mg',
      price: -5,
    });
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing required fields', async () => {
    const res = await request.post('/api/medications').send({ name: 'Incomplete' });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/medications/:id', () => {
  it('updates an existing medication', async () => {
    const med = await createMedication({ name: 'Old Med', strength: '100mg' });

    const res = await request.put(`/api/medications/${med.id}`).send({
      name: 'Updated Med',
      dosageForm: 'INJECTION',
      strength: '200mg',
      price: 25.00,
    });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Updated Med');
    expect(res.body.dosageForm).toBe('INJECTION');
    expect(res.body.strength).toBe('200mg');
  });

  it('returns 404 for non-existent medication', async () => {
    const res = await request.put('/api/medications/99999').send({
      name: 'Nope',
      dosageForm: 'TABLET',
      strength: '10mg',
      price: 1,
    });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/medications/:id', () => {
  it('deletes an existing medication', async () => {
    const med = await createMedication({ name: 'To Delete' });

    const res = await request.delete(`/api/medications/${med.id}`);
    expect(res.status).toBe(204);

    const getRes = await request.get(`/api/medications/${med.id}`);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 for non-existent medication', async () => {
    const res = await request.delete('/api/medications/99999');
    expect(res.status).toBe(404);
  });
});
