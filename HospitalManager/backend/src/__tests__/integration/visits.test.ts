import { describe, it, expect } from 'vitest';
import { request } from './setup/test-app';
import { createPatient, createDoctor, createVisit } from './setup/fixtures';

describe('Visits API', () => {
  async function setupPatientAndDoctor() {
    const patient = await createPatient();
    const doctor = await createDoctor();
    return { patient, doctor };
  }

  describe('GET /api/visits', () => {
    it('returns empty list when no visits', async () => {
      const res = await request.get('/api/visits');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
    });

    it('returns visits with patient and doctor info', async () => {
      const { patient, doctor } = await setupPatientAndDoctor();
      await createVisit(patient.id, doctor.id);

      const res = await request.get('/api/visits');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].patient).toBeDefined();
      expect(res.body.data[0].doctor).toBeDefined();
    });

    it('filters by patientId', async () => {
      const patient1 = await createPatient({ firstName: 'V1' });
      const patient2 = await createPatient({ firstName: 'V2' });
      const doctor = await createDoctor();
      await createVisit(patient1.id, doctor.id);
      await createVisit(patient2.id, doctor.id);

      const res = await request.get(`/api/visits?patientId=${patient1.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].patientId).toBe(patient1.id);
    });
  });

  describe('GET /api/visits/:id', () => {
    it('returns visit with deep includes (diagnoses, labOrders, prescriptions)', async () => {
      const { patient, doctor } = await setupPatientAndDoctor();
      const visit = await createVisit(patient.id, doctor.id);

      const res = await request.get(`/api/visits/${visit.id}`);
      expect(res.status).toBe(200);
      expect(res.body.patient).toBeDefined();
      expect(res.body.doctor).toBeDefined();
      expect(res.body.diagnoses).toBeDefined();
      expect(Array.isArray(res.body.diagnoses)).toBe(true);
      expect(res.body.labOrders).toBeDefined();
      expect(Array.isArray(res.body.labOrders)).toBe(true);
      expect(res.body.prescriptions).toBeDefined();
      expect(Array.isArray(res.body.prescriptions)).toBe(true);
    });

    it('returns 404 for non-existent visit', async () => {
      const res = await request.get('/api/visits/99999');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Visit not found');
    });
  });

  describe('POST /api/visits', () => {
    it('creates a visit with all fields', async () => {
      const { patient, doctor } = await setupPatientAndDoctor();

      const res = await request.post('/api/visits').send({
        patientId: patient.id,
        doctorId: doctor.id,
        visitDate: '2024-06-15T10:00:00+00:00',
        chiefComplaint: 'Headache and fever',
        vitalSigns: 'BP: 120/80, Temp: 101F',
        notes: 'Patient reports symptoms for 3 days',
      });

      expect(res.status).toBe(201);
      expect(res.body.patientId).toBe(patient.id);
      expect(res.body.doctorId).toBe(doctor.id);
      expect(res.body.chiefComplaint).toBe('Headache and fever');
      expect(res.body.vitalSigns).toBe('BP: 120/80, Temp: 101F');
      expect(res.body.notes).toBe('Patient reports symptoms for 3 days');
      expect(res.body.patient).toBeDefined();
      expect(res.body.doctor).toBeDefined();
    });

    it('creates a visit with minimal fields', async () => {
      const { patient, doctor } = await setupPatientAndDoctor();

      const res = await request.post('/api/visits').send({
        patientId: patient.id,
        doctorId: doctor.id,
        visitDate: '2024-06-15T14:00:00+00:00',
      });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
    });

    it('returns 400 for missing required fields', async () => {
      const res = await request.post('/api/visits').send({
        patientId: 1,
      });
      expect(res.status).toBe(400);
    });

    it('returns 400 for invalid visitDate format', async () => {
      const { patient, doctor } = await setupPatientAndDoctor();

      const res = await request.post('/api/visits').send({
        patientId: patient.id,
        doctorId: doctor.id,
        visitDate: 'not-a-date',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/visits/:id', () => {
    it('deletes a visit', async () => {
      const { patient, doctor } = await setupPatientAndDoctor();
      const visit = await createVisit(patient.id, doctor.id);

      const res = await request.delete(`/api/visits/${visit.id}`);
      expect(res.status).toBe(204);

      const getRes = await request.get(`/api/visits/${visit.id}`);
      expect(getRes.status).toBe(404);
    });

    it('returns 404 for non-existent visit', async () => {
      const res = await request.delete('/api/visits/99999');
      expect(res.status).toBe(404);
    });
  });
});
