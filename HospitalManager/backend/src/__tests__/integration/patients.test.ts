import { describe, it, expect } from 'vitest';
import { request } from './setup/test-app';
import { createPatient, createDoctor, createVisit, createAppointment } from './setup/fixtures';

describe('GET /api/patients', () => {
  it('returns empty list when no patients', async () => {
    const res = await request.get('/api/patients');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it('returns patients with _count for visits and appointments', async () => {
    const patient = await createPatient();
    const doctor = await createDoctor();
    await createVisit(patient.id, doctor.id);
    await createAppointment(patient.id, doctor.id);

    const res = await request.get('/api/patients');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]._count.visits).toBe(1);
    expect(res.body.data[0]._count.appointments).toBe(1);
  });

  it('supports search by firstName', async () => {
    await createPatient({ firstName: 'Alice', lastName: 'Smith' });
    await createPatient({ firstName: 'Bob', lastName: 'Jones' });

    const res = await request.get('/api/patients?search=Alice');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].firstName).toBe('Alice');
  });

  it('supports search by lastName', async () => {
    await createPatient({ firstName: 'Alice', lastName: 'Wonderland' });
    await createPatient({ firstName: 'Bob', lastName: 'Builder' });

    const res = await request.get('/api/patients?search=Wonderland');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].lastName).toBe('Wonderland');
  });
});

describe('GET /api/patients/:id', () => {
  it('returns patient with insurances, visits, and appointments', async () => {
    const patient = await createPatient();
    const doctor = await createDoctor();
    await createVisit(patient.id, doctor.id);
    await createAppointment(patient.id, doctor.id);

    const res = await request.get(`/api/patients/${patient.id}`);
    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('John');
    expect(res.body.insurances).toBeDefined();
    expect(Array.isArray(res.body.insurances)).toBe(true);
    expect(res.body.visits).toHaveLength(1);
    expect(res.body.appointments).toHaveLength(1);
  });

  it('returns 404 for non-existent patient', async () => {
    const res = await request.get('/api/patients/99999');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Patient not found');
  });
});

describe('POST /api/patients', () => {
  it('creates a patient with minimal required fields', async () => {
    const res = await request.post('/api/patients').send({
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: '1985-06-15',
      gender: 'FEMALE',
    });

    expect(res.status).toBe(201);
    expect(res.body.firstName).toBe('Jane');
    expect(res.body.lastName).toBe('Doe');
    expect(res.body.gender).toBe('FEMALE');
    expect(res.body.id).toBeDefined();
  });

  it('creates a patient with all fields', async () => {
    const res = await request.post('/api/patients').send({
      firstName: 'Full',
      lastName: 'Patient',
      dateOfBirth: '1990-03-20',
      gender: 'MALE',
      ssn: '123-45-6789',
      email: 'full@test.com',
      phone: '555-1234',
      address: '123 Main St',
      city: 'Springfield',
      state: 'IL',
      zipCode: '62701',
      bloodType: 'O+',
      allergies: 'Penicillin',
      emergencyName: 'Mary Patient',
      emergencyPhone: '555-5678',
      emergencyRelation: 'Spouse',
      medicalNotes: 'No significant history',
    });

    expect(res.status).toBe(201);
    expect(res.body.bloodType).toBe('O+');
    expect(res.body.allergies).toBe('Penicillin');
    expect(res.body.emergencyName).toBe('Mary Patient');
  });

  it('returns 400 for invalid gender enum', async () => {
    const res = await request.post('/api/patients').send({
      firstName: 'Bad',
      lastName: 'Gender',
      dateOfBirth: '2000-01-01',
      gender: 'UNKNOWN',
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation error');
  });

  it('returns 400 for missing required fields', async () => {
    const res = await request.post('/api/patients').send({ firstName: 'Only' });
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid blood type', async () => {
    const res = await request.post('/api/patients').send({
      firstName: 'Bad',
      lastName: 'Blood',
      dateOfBirth: '2000-01-01',
      gender: 'MALE',
      bloodType: 'X+',
    });
    expect(res.status).toBe(400);
  });
});

describe('PUT /api/patients/:id', () => {
  it('updates an existing patient', async () => {
    const patient = await createPatient({ firstName: 'Old', lastName: 'Name' });

    const res = await request.put(`/api/patients/${patient.id}`).send({
      firstName: 'New',
      lastName: 'Name',
      dateOfBirth: '1990-01-01',
      gender: 'FEMALE',
      phone: '555-9999',
    });

    expect(res.status).toBe(200);
    expect(res.body.firstName).toBe('New');
    expect(res.body.gender).toBe('FEMALE');
    expect(res.body.phone).toBe('555-9999');
  });

  it('returns 404 for non-existent patient', async () => {
    const res = await request.put('/api/patients/99999').send({
      firstName: 'No',
      lastName: 'One',
      dateOfBirth: '2000-01-01',
      gender: 'MALE',
    });
    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/patients/:id', () => {
  it('deletes a patient and cascades', async () => {
    const patient = await createPatient();

    const res = await request.delete(`/api/patients/${patient.id}`);
    expect(res.status).toBe(204);

    const getRes = await request.get(`/api/patients/${patient.id}`);
    expect(getRes.status).toBe(404);
  });

  it('returns 404 for non-existent patient', async () => {
    const res = await request.delete('/api/patients/99999');
    expect(res.status).toBe(404);
  });
});
