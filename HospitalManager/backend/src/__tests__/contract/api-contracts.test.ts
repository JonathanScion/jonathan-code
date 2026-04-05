import { describe, it, expect } from 'vitest';
import { request } from '../integration/setup/test-app';
import {
  createDepartment,
  createPatient,
  createDoctor,
  createRoom,
  createBed,
  createMedication,
  createSupplier,
  createInsurancePlan,
  createVisit,
  createBill,
  createAppointment,
} from '../integration/setup/fixtures';
import {
  PaginatedResponseSchema,
  DepartmentSchema,
  PatientSchema,
  AppointmentSchema,
  VisitSchema,
  BillSchema,
  BillLineItemSchema,
  DashboardStatsSchema,
  MedicationSchema,
  RoomSchema,
  SupplierSchema,
  InsurancePlanSchema,
} from './response-schemas';

describe('Contract Tests', () => {
  describe('Departments', () => {
    it('GET /api/departments returns paginated departments', async () => {
      await createDepartment({ name: 'Contract Test Dept' });
      const res = await request.get('/api/departments');
      expect(res.status).toBe(200);
      const result = PaginatedResponseSchema(DepartmentSchema).safeParse(res.body);
      expect(result.success).toBe(true);
    });

    it('GET /api/departments/:id returns department shape', async () => {
      const dept = await createDepartment({ name: 'Shape Test' });
      const res = await request.get(`/api/departments/${dept.id}`);
      expect(res.status).toBe(200);
      const result = DepartmentSchema.safeParse(res.body);
      expect(result.success).toBe(true);
    });

    it('POST /api/departments returns department shape', async () => {
      const res = await request.post('/api/departments').send({ name: 'New Dept' });
      expect(res.status).toBe(201);
      const result = DepartmentSchema.safeParse(res.body);
      expect(result.success).toBe(true);
    });
  });

  describe('Rooms', () => {
    it('GET /api/rooms returns paginated rooms', async () => {
      await createRoom({ number: 'CR1' });
      const res = await request.get('/api/rooms');
      expect(res.status).toBe(200);
      const result = PaginatedResponseSchema(RoomSchema).safeParse(res.body);
      expect(result.success).toBe(true);
    });
  });

  describe('Medications', () => {
    it('GET /api/medications returns paginated medications', async () => {
      await createMedication();
      const res = await request.get('/api/medications');
      expect(res.status).toBe(200);
      const result = PaginatedResponseSchema(MedicationSchema).safeParse(res.body);
      expect(result.success).toBe(true);
    });
  });

  describe('Suppliers', () => {
    it('GET /api/suppliers returns paginated suppliers', async () => {
      await createSupplier();
      const res = await request.get('/api/suppliers');
      expect(res.status).toBe(200);
      const result = PaginatedResponseSchema(SupplierSchema).safeParse(res.body);
      expect(result.success).toBe(true);
    });
  });

  describe('Insurance Plans', () => {
    it('GET /api/insurance-plans returns paginated plans', async () => {
      await createInsurancePlan();
      const res = await request.get('/api/insurance-plans');
      expect(res.status).toBe(200);
      const result = PaginatedResponseSchema(InsurancePlanSchema).safeParse(res.body);
      expect(result.success).toBe(true);
    });
  });

  describe('Patients', () => {
    it('GET /api/patients returns paginated patients', async () => {
      await createPatient();
      const res = await request.get('/api/patients');
      expect(res.status).toBe(200);
      const result = PaginatedResponseSchema(PatientSchema).safeParse(res.body);
      expect(result.success).toBe(true);
    });

    it('POST /api/patients returns patient shape', async () => {
      const res = await request.post('/api/patients').send({
        firstName: 'Jane',
        lastName: 'Contract',
        dateOfBirth: '1985-05-15',
        gender: 'FEMALE',
      });
      expect(res.status).toBe(201);
      const result = PatientSchema.safeParse(res.body);
      expect(result.success).toBe(true);
    });
  });

  describe('Appointments', () => {
    it('GET /api/appointments returns paginated appointments', async () => {
      const patient = await createPatient();
      const doctor = await createDoctor();
      await createAppointment(patient.id, doctor.id);

      const res = await request.get('/api/appointments');
      expect(res.status).toBe(200);
      const result = PaginatedResponseSchema(AppointmentSchema).safeParse(res.body);
      expect(result.success).toBe(true);
    });

    it('GET /api/appointments/:id returns appointment with includes', async () => {
      const patient = await createPatient();
      const doctor = await createDoctor();
      const appt = await createAppointment(patient.id, doctor.id);

      const res = await request.get(`/api/appointments/${appt.id}`);
      expect(res.status).toBe(200);
      const result = AppointmentSchema.safeParse(res.body);
      expect(result.success).toBe(true);
      expect(res.body.patient).toBeDefined();
      expect(res.body.doctor).toBeDefined();
    });
  });

  describe('Visits', () => {
    it('GET /api/visits returns paginated visits', async () => {
      const patient = await createPatient();
      const doctor = await createDoctor();
      await createVisit(patient.id, doctor.id);

      const res = await request.get('/api/visits');
      expect(res.status).toBe(200);
      const result = PaginatedResponseSchema(VisitSchema).safeParse(res.body);
      expect(result.success).toBe(true);
    });
  });

  describe('Bills', () => {
    it('GET /api/bills returns paginated bills', async () => {
      const patient = await createPatient();
      await createBill(patient.id);

      const res = await request.get('/api/bills');
      expect(res.status).toBe(200);
      const result = PaginatedResponseSchema(BillSchema).safeParse(res.body);
      expect(result.success).toBe(true);
    });

    it('POST /api/bill-line-items returns line item shape', async () => {
      const patient = await createPatient();
      const bill = await createBill(patient.id);

      const res = await request.post('/api/bill-line-items').send({
        billId: bill.id,
        description: 'Contract test item',
        category: 'CONSULTATION',
        quantity: 1,
        unitPrice: 100,
      });
      expect(res.status).toBe(201);
      const result = BillLineItemSchema.safeParse(res.body);
      expect(result.success).toBe(true);
    });
  });

  describe('Dashboard', () => {
    it('GET /api/dashboard returns correct shape', async () => {
      const res = await request.get('/api/dashboard');
      expect(res.status).toBe(200);
      const result = DashboardStatsSchema.safeParse(res.body);
      expect(result.success).toBe(true);
    });
  });
});
