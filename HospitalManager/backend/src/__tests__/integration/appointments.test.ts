import { describe, it, expect } from 'vitest';
import { request } from './setup/test-app';
import { createPatient, createDoctor, createAppointment } from './setup/fixtures';

describe('Appointments API', () => {
  async function setupPatientAndDoctor() {
    const patient = await createPatient();
    const doctor = await createDoctor();
    return { patient, doctor };
  }

  describe('GET /api/appointments', () => {
    it('returns empty list', async () => {
      const res = await request.get('/api/appointments');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
    });

    it('includes patient and doctor details', async () => {
      const { patient, doctor } = await setupPatientAndDoctor();
      await createAppointment(patient.id, doctor.id);

      const res = await request.get('/api/appointments');
      expect(res.status).toBe(200);
      expect(res.body.data[0].patient).toBeDefined();
      expect(res.body.data[0].doctor).toBeDefined();
    });

    it('filters by status', async () => {
      const { patient, doctor } = await setupPatientAndDoctor();
      await createAppointment(patient.id, doctor.id, { status: 'SCHEDULED' });
      await createAppointment(patient.id, doctor.id, { status: 'COMPLETED' });

      const res = await request.get('/api/appointments?status=SCHEDULED');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe('SCHEDULED');
    });

    it('filters by patientId', async () => {
      const patient1 = await createPatient({ firstName: 'P1' });
      const patient2 = await createPatient({ firstName: 'P2' });
      const doctor = await createDoctor();
      await createAppointment(patient1.id, doctor.id);
      await createAppointment(patient2.id, doctor.id);

      const res = await request.get(`/api/appointments?patientId=${patient1.id}`);
      expect(res.body.data).toHaveLength(1);
    });
  });

  describe('POST /api/appointments', () => {
    it('creates an appointment with default SCHEDULED status', async () => {
      const { patient, doctor } = await setupPatientAndDoctor();

      const res = await request.post('/api/appointments').send({
        patientId: patient.id,
        doctorId: doctor.id,
        dateTime: '2024-06-15T10:00:00+00:00',
        duration: 30,
        type: 'CONSULTATION',
      });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('SCHEDULED');
      expect(res.body.patient).toBeDefined();
    });

    it('returns 400 for invalid type', async () => {
      const { patient, doctor } = await setupPatientAndDoctor();
      const res = await request.post('/api/appointments').send({
        patientId: patient.id,
        doctorId: doctor.id,
        dateTime: '2024-06-15T10:00:00+00:00',
        duration: 30,
        type: 'INVALID',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/appointments/:id/status', () => {
    it('transitions SCHEDULED → CONFIRMED', async () => {
      const { patient, doctor } = await setupPatientAndDoctor();
      const appt = await createAppointment(patient.id, doctor.id, { status: 'SCHEDULED' });

      const res = await request
        .patch(`/api/appointments/${appt.id}/status`)
        .send({ status: 'CONFIRMED' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CONFIRMED');
    });

    it('transitions CONFIRMED → IN_PROGRESS', async () => {
      const { patient, doctor } = await setupPatientAndDoctor();
      const appt = await createAppointment(patient.id, doctor.id, { status: 'CONFIRMED' });

      const res = await request
        .patch(`/api/appointments/${appt.id}/status`)
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('IN_PROGRESS');
    });

    it('transitions IN_PROGRESS → COMPLETED', async () => {
      const { patient, doctor } = await setupPatientAndDoctor();
      const appt = await createAppointment(patient.id, doctor.id, { status: 'IN_PROGRESS' });

      const res = await request
        .patch(`/api/appointments/${appt.id}/status`)
        .send({ status: 'COMPLETED' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('COMPLETED');
    });

    it('transitions SCHEDULED → CANCELLED', async () => {
      const { patient, doctor } = await setupPatientAndDoctor();
      const appt = await createAppointment(patient.id, doctor.id, { status: 'SCHEDULED' });

      const res = await request
        .patch(`/api/appointments/${appt.id}/status`)
        .send({ status: 'CANCELLED' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('CANCELLED');
    });

    it('rejects invalid transition SCHEDULED → COMPLETED', async () => {
      const { patient, doctor } = await setupPatientAndDoctor();
      const appt = await createAppointment(patient.id, doctor.id, { status: 'SCHEDULED' });

      const res = await request
        .patch(`/api/appointments/${appt.id}/status`)
        .send({ status: 'COMPLETED' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot transition');
    });

    it('rejects transition from terminal COMPLETED status', async () => {
      const { patient, doctor } = await setupPatientAndDoctor();
      const appt = await createAppointment(patient.id, doctor.id, { status: 'COMPLETED' });

      const res = await request
        .patch(`/api/appointments/${appt.id}/status`)
        .send({ status: 'CANCELLED' });

      expect(res.status).toBe(400);
    });

    it('rejects transition from terminal CANCELLED status', async () => {
      const { patient, doctor } = await setupPatientAndDoctor();
      const appt = await createAppointment(patient.id, doctor.id, { status: 'CANCELLED' });

      const res = await request
        .patch(`/api/appointments/${appt.id}/status`)
        .send({ status: 'SCHEDULED' });

      expect(res.status).toBe(400);
    });

    it('returns 404 for non-existent appointment', async () => {
      const res = await request
        .patch('/api/appointments/99999/status')
        .send({ status: 'CONFIRMED' });
      expect(res.status).toBe(404);
    });

    it('full workflow: SCHEDULED → CONFIRMED → IN_PROGRESS → COMPLETED', async () => {
      const { patient, doctor } = await setupPatientAndDoctor();
      const appt = await createAppointment(patient.id, doctor.id);

      let res = await request.patch(`/api/appointments/${appt.id}/status`).send({ status: 'CONFIRMED' });
      expect(res.body.status).toBe('CONFIRMED');

      res = await request.patch(`/api/appointments/${appt.id}/status`).send({ status: 'IN_PROGRESS' });
      expect(res.body.status).toBe('IN_PROGRESS');

      res = await request.patch(`/api/appointments/${appt.id}/status`).send({ status: 'COMPLETED' });
      expect(res.body.status).toBe('COMPLETED');
    });
  });

  describe('DELETE /api/appointments/:id', () => {
    it('deletes an appointment', async () => {
      const { patient, doctor } = await setupPatientAndDoctor();
      const appt = await createAppointment(patient.id, doctor.id);

      const res = await request.delete(`/api/appointments/${appt.id}`);
      expect(res.status).toBe(204);
    });
  });
});
