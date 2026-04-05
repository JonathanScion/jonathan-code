import { describe, it, expect } from 'vitest';
import { request } from './setup/test-app';
import { createPatient, createDoctor, createRoom, createBed, createAdmission } from './setup/fixtures';

describe('Admissions API', () => {
  async function setupAdmissionDeps() {
    const patient = await createPatient();
    const doctor = await createDoctor();
    const room = await createRoom();
    return { patient, doctor, room };
  }

  describe('GET /api/admissions', () => {
    it('returns empty list when no admissions', async () => {
      const res = await request.get('/api/admissions');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
    });

    it('returns admissions with patient, doctor, room includes', async () => {
      const { patient, doctor, room } = await setupAdmissionDeps();
      await createAdmission(patient.id, doctor.id, room.id);

      const res = await request.get('/api/admissions');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].patient).toBeDefined();
      expect(res.body.data[0].doctor).toBeDefined();
      expect(res.body.data[0].room).toBeDefined();
    });

    it('filters by patientId', async () => {
      const patient1 = await createPatient({ firstName: 'P1' });
      const patient2 = await createPatient({ firstName: 'P2' });
      const doctor = await createDoctor();
      const room = await createRoom();
      await createAdmission(patient1.id, doctor.id, room.id);
      await createAdmission(patient2.id, doctor.id, room.id);

      const res = await request.get(`/api/admissions?patientId=${patient1.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].patientId).toBe(patient1.id);
    });

    it('filters by status', async () => {
      const { patient, doctor, room } = await setupAdmissionDeps();
      await createAdmission(patient.id, doctor.id, room.id, { status: 'ADMITTED' });
      await createAdmission(patient.id, doctor.id, room.id, { status: 'DISCHARGED', dischargeDate: new Date() });

      const res = await request.get('/api/admissions?status=ADMITTED');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe('ADMITTED');
    });
  });

  describe('POST /api/admissions', () => {
    it('creates an admission with default ADMITTED status', async () => {
      const { patient, doctor, room } = await setupAdmissionDeps();

      const res = await request.post('/api/admissions').send({
        patientId: patient.id,
        doctorId: doctor.id,
        roomId: room.id,
        admitDate: '2024-06-15T10:00:00+00:00',
        reason: 'Surgery',
      });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('ADMITTED');
      expect(res.body.reason).toBe('Surgery');
      expect(res.body.patient).toBeDefined();
      expect(res.body.room).toBeDefined();
    });

    it('creates an admission with a bed assignment', async () => {
      const { patient, doctor, room } = await setupAdmissionDeps();
      const bed = await createBed(room.id);

      const res = await request.post('/api/admissions').send({
        patientId: patient.id,
        doctorId: doctor.id,
        roomId: room.id,
        bedId: bed.id,
        admitDate: '2024-06-15',
      });

      expect(res.status).toBe(201);
      expect(res.body.bedId).toBe(bed.id);
    });

    it('returns 400 for missing required fields', async () => {
      const res = await request.post('/api/admissions').send({
        patientId: 1,
      });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/admissions/:id/status', () => {
    it('transitions ADMITTED to DISCHARGED and sets dischargeDate', async () => {
      const { patient, doctor, room } = await setupAdmissionDeps();
      const admission = await createAdmission(patient.id, doctor.id, room.id);

      const res = await request
        .patch(`/api/admissions/${admission.id}/status`)
        .send({ status: 'DISCHARGED' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('DISCHARGED');
      expect(res.body.dischargeDate).toBeDefined();
      expect(res.body.dischargeDate).not.toBeNull();
    });

    it('transitions ADMITTED to TRANSFERRED', async () => {
      const { patient, doctor, room } = await setupAdmissionDeps();
      const admission = await createAdmission(patient.id, doctor.id, room.id);

      const res = await request
        .patch(`/api/admissions/${admission.id}/status`)
        .send({ status: 'TRANSFERRED' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('TRANSFERRED');
    });

    it('releases bed when discharging patient with bed assignment', async () => {
      const { patient, doctor, room } = await setupAdmissionDeps();
      const bed = await createBed(room.id, { status: 'OCCUPIED' });
      const admission = await createAdmission(patient.id, doctor.id, room.id, { bedId: bed.id });

      const res = await request
        .patch(`/api/admissions/${admission.id}/status`)
        .send({ status: 'DISCHARGED' });

      expect(res.status).toBe(200);

      // Verify bed status is now AVAILABLE
      const bedRes = await request.get(`/api/beds/${bed.id}`);
      expect(bedRes.body.status).toBe('AVAILABLE');
    });

    it('rejects invalid transition DISCHARGED to ADMITTED', async () => {
      const { patient, doctor, room } = await setupAdmissionDeps();
      const admission = await createAdmission(patient.id, doctor.id, room.id, {
        status: 'DISCHARGED',
        dischargeDate: new Date(),
      });

      const res = await request
        .patch(`/api/admissions/${admission.id}/status`)
        .send({ status: 'ADMITTED' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot transition');
    });

    it('rejects invalid transition TRANSFERRED to ADMITTED', async () => {
      const { patient, doctor, room } = await setupAdmissionDeps();
      const admission = await createAdmission(patient.id, doctor.id, room.id, {
        status: 'TRANSFERRED',
      });

      const res = await request
        .patch(`/api/admissions/${admission.id}/status`)
        .send({ status: 'ADMITTED' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot transition');
    });

    it('returns 404 for non-existent admission', async () => {
      const res = await request
        .patch('/api/admissions/99999/status')
        .send({ status: 'DISCHARGED' });
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/admissions/:id', () => {
    it('deletes an admission', async () => {
      const { patient, doctor, room } = await setupAdmissionDeps();
      const admission = await createAdmission(patient.id, doctor.id, room.id);

      const res = await request.delete(`/api/admissions/${admission.id}`);
      expect(res.status).toBe(204);

      const getRes = await request.get(`/api/admissions/${admission.id}`);
      expect(getRes.status).toBe(404);
    });

    it('returns 404 for non-existent admission', async () => {
      const res = await request.delete('/api/admissions/99999');
      expect(res.status).toBe(404);
    });
  });
});
