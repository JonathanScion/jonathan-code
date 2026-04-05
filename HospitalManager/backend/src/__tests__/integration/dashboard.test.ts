import { describe, it, expect } from 'vitest';
import { request } from './setup/test-app';
import {
  createPatient,
  createDoctor,
  createRoom,
  createBed,
  createAppointment,
  createBill,
  createVisit,
} from './setup/fixtures';

describe('GET /api/dashboard', () => {
  it('returns correct structure with all 5 stats', async () => {
    const res = await request.get('/api/dashboard');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('patientCount');
    expect(res.body).toHaveProperty('todayAppointments');
    expect(res.body).toHaveProperty('bedOccupancy');
    expect(res.body.bedOccupancy).toHaveProperty('occupied');
    expect(res.body.bedOccupancy).toHaveProperty('total');
    expect(res.body).toHaveProperty('pendingLabOrders');
    expect(res.body).toHaveProperty('outstandingBills');
    expect(res.body.outstandingBills).toHaveProperty('count');
    expect(res.body.outstandingBills).toHaveProperty('total');
  });

  it('returns zeros when DB is empty', async () => {
    const res = await request.get('/api/dashboard');
    expect(res.status).toBe(200);
    expect(res.body.patientCount).toBe(0);
    expect(res.body.todayAppointments).toBe(0);
    expect(res.body.bedOccupancy.occupied).toBe(0);
    expect(res.body.bedOccupancy.total).toBe(0);
    expect(res.body.pendingLabOrders).toBe(0);
    expect(res.body.outstandingBills.count).toBe(0);
    expect(Number(res.body.outstandingBills.total)).toBe(0);
  });

  it('counts patients correctly', async () => {
    await createPatient({ firstName: 'A' });
    await createPatient({ firstName: 'B' });
    await createPatient({ firstName: 'C' });

    const res = await request.get('/api/dashboard');
    expect(res.body.patientCount).toBe(3);
  });

  it('counts today non-cancelled appointments', async () => {
    const patient = await createPatient();
    const doctor = await createDoctor();

    // Today's appointments with different statuses
    const now = new Date();
    await createAppointment(patient.id, doctor.id, {
      dateTime: now,
      status: 'SCHEDULED',
    });
    await createAppointment(patient.id, doctor.id, {
      dateTime: now,
      status: 'CONFIRMED',
    });
    await createAppointment(patient.id, doctor.id, {
      dateTime: now,
      status: 'CANCELLED',
    });

    // Yesterday's appointment (should not be counted)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    await createAppointment(patient.id, doctor.id, {
      dateTime: yesterday,
      status: 'SCHEDULED',
    });

    const res = await request.get('/api/dashboard');
    // 2 today non-cancelled (SCHEDULED + CONFIRMED), not the CANCELLED one or yesterday's
    expect(res.body.todayAppointments).toBe(2);
  });

  it('computes bed occupancy (occupied vs total)', async () => {
    const room = await createRoom();
    await createBed(room.id, { status: 'OCCUPIED' });
    await createBed(room.id, { status: 'OCCUPIED', number: `B${Date.now()}a` });
    await createBed(room.id, { status: 'AVAILABLE', number: `B${Date.now()}b` });
    await createBed(room.id, { status: 'MAINTENANCE', number: `B${Date.now()}c` });

    const res = await request.get('/api/dashboard');
    expect(res.body.bedOccupancy.occupied).toBe(2);
    expect(res.body.bedOccupancy.total).toBe(4);
  });

  it('counts pending lab orders (ORDERED and IN_PROGRESS)', async () => {
    const patient = await createPatient();
    const doctor = await createDoctor();
    const visit = await createVisit(patient.id, doctor.id);

    // Create lab orders via API
    await request.post('/api/lab-orders').send({
      visitId: visit.id,
      testName: 'CBC',
      category: 'BLOOD',
      status: 'ORDERED',
    });
    await request.post('/api/lab-orders').send({
      visitId: visit.id,
      testName: 'Urinalysis',
      category: 'URINE',
      status: 'IN_PROGRESS',
    });
    await request.post('/api/lab-orders').send({
      visitId: visit.id,
      testName: 'X-Ray',
      category: 'IMAGING',
      status: 'COMPLETED',
    });

    const res = await request.get('/api/dashboard');
    // ORDERED + IN_PROGRESS = 2, COMPLETED should not count
    expect(res.body.pendingLabOrders).toBe(2);
  });

  it('computes outstanding bills (count + total sum)', async () => {
    const patient = await createPatient();

    // Create bills with different statuses and amounts
    const bill1 = await createBill(patient.id, { status: 'PENDING', totalAmount: 100.00 });
    const bill2 = await createBill(patient.id, { status: 'PARTIAL', totalAmount: 250.50 });
    const bill3 = await createBill(patient.id, { status: 'OVERDUE', totalAmount: 75.00 });
    await createBill(patient.id, { status: 'PAID', totalAmount: 500.00 });
    await createBill(patient.id, { status: 'CANCELLED', totalAmount: 200.00 });

    const res = await request.get('/api/dashboard');
    // Outstanding = PENDING + PARTIAL + OVERDUE
    expect(res.body.outstandingBills.count).toBe(3);
    expect(Number(res.body.outstandingBills.total)).toBe(425.50); // 100 + 250.50 + 75
  });
});
