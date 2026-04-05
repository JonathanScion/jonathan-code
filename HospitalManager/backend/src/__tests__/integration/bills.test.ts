import { describe, it, expect } from 'vitest';
import { request } from './setup/test-app';
import { createPatient, createBill } from './setup/fixtures';

describe('Bills API', () => {
  describe('GET /api/bills', () => {
    it('returns empty list when no bills', async () => {
      const res = await request.get('/api/bills');
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
    });

    it('returns bills with patient info', async () => {
      const patient = await createPatient();
      await createBill(patient.id);

      const res = await request.get('/api/bills');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].patient).toBeDefined();
      expect(res.body.data[0].patient.firstName).toBeDefined();
    });

    it('filters by patientId', async () => {
      const patient1 = await createPatient({ firstName: 'P1' });
      const patient2 = await createPatient({ firstName: 'P2' });
      await createBill(patient1.id);
      await createBill(patient2.id);

      const res = await request.get(`/api/bills?patientId=${patient1.id}`);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].patientId).toBe(patient1.id);
    });

    it('filters by status', async () => {
      const patient = await createPatient();
      await createBill(patient.id, { status: 'PENDING' });
      await createBill(patient.id, { status: 'PAID' });

      const res = await request.get('/api/bills?status=PAID');
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].status).toBe('PAID');
    });
  });

  describe('POST /api/bills', () => {
    it('creates a bill with default PENDING status', async () => {
      const patient = await createPatient();

      const res = await request.post('/api/bills').send({
        patientId: patient.id,
        date: '2024-06-15T10:00:00+00:00',
      });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('PENDING');
      expect(res.body.patientId).toBe(patient.id);
      expect(res.body.patient).toBeDefined();
      expect(res.body.id).toBeDefined();
    });

    it('creates a bill with notes and dueDate', async () => {
      const patient = await createPatient();

      const res = await request.post('/api/bills').send({
        patientId: patient.id,
        date: '2024-06-15',
        dueDate: '2024-07-15',
        notes: 'Emergency visit charges',
      });

      expect(res.status).toBe(201);
      expect(res.body.notes).toBe('Emergency visit charges');
      expect(res.body.dueDate).toBeDefined();
    });

    it('returns 400 for missing required fields', async () => {
      const res = await request.post('/api/bills').send({});
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/bills/:id/status', () => {
    it('transitions PENDING to PAID', async () => {
      const patient = await createPatient();
      const bill = await createBill(patient.id);

      const res = await request
        .patch(`/api/bills/${bill.id}/status`)
        .send({ status: 'PAID' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PAID');
    });

    it('transitions PENDING to PARTIAL', async () => {
      const patient = await createPatient();
      const bill = await createBill(patient.id);

      const res = await request
        .patch(`/api/bills/${bill.id}/status`)
        .send({ status: 'PARTIAL' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('PARTIAL');
    });

    it('transitions PENDING to OVERDUE', async () => {
      const patient = await createPatient();
      const bill = await createBill(patient.id);

      const res = await request
        .patch(`/api/bills/${bill.id}/status`)
        .send({ status: 'OVERDUE' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('OVERDUE');
    });

    it('rejects invalid transition PAID to PENDING', async () => {
      const patient = await createPatient();
      const bill = await createBill(patient.id, { status: 'PAID' });

      const res = await request
        .patch(`/api/bills/${bill.id}/status`)
        .send({ status: 'PENDING' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot transition');
    });

    it('rejects invalid transition CANCELLED to PAID', async () => {
      const patient = await createPatient();
      const bill = await createBill(patient.id, { status: 'CANCELLED' });

      const res = await request
        .patch(`/api/bills/${bill.id}/status`)
        .send({ status: 'PAID' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot transition');
    });

    it('returns 404 for non-existent bill', async () => {
      const res = await request
        .patch('/api/bills/99999/status')
        .send({ status: 'PAID' });
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/bills/:id/recalculate', () => {
    it('recalculates totalAmount from line items', async () => {
      const patient = await createPatient();
      const bill = await createBill(patient.id);

      // Add line items
      await request.post('/api/bill-line-items').send({
        billId: bill.id,
        description: 'Consultation',
        category: 'CONSULTATION',
        quantity: 1,
        unitPrice: 150.00,
      });
      await request.post('/api/bill-line-items').send({
        billId: bill.id,
        description: 'Blood Test',
        category: 'LAB',
        quantity: 2,
        unitPrice: 50.00,
      });

      const res = await request.post(`/api/bills/${bill.id}/recalculate`);
      expect(res.status).toBe(200);
      expect(Number(res.body.totalAmount)).toBe(250.00); // 150 + (2*50)
      expect(res.body.lineItems).toHaveLength(2);
    });

    it('sets totalAmount to 0 when no line items', async () => {
      const patient = await createPatient();
      const bill = await createBill(patient.id);

      const res = await request.post(`/api/bills/${bill.id}/recalculate`);
      expect(res.status).toBe(200);
      expect(Number(res.body.totalAmount)).toBe(0);
    });

    it('returns 404 for non-existent bill', async () => {
      const res = await request.post('/api/bills/99999/recalculate');
      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/bills/:id', () => {
    it('deletes a bill', async () => {
      const patient = await createPatient();
      const bill = await createBill(patient.id);

      const res = await request.delete(`/api/bills/${bill.id}`);
      expect(res.status).toBe(204);

      const getRes = await request.get(`/api/bills/${bill.id}`);
      expect(getRes.status).toBe(404);
    });
  });
});

describe('Bill Line Items API', () => {
  describe('POST /api/bill-line-items', () => {
    it('creates a line item with computed total', async () => {
      const patient = await createPatient();
      const bill = await createBill(patient.id);

      const res = await request.post('/api/bill-line-items').send({
        billId: bill.id,
        description: 'X-Ray',
        category: 'PROCEDURE',
        quantity: 1,
        unitPrice: 200.00,
      });

      expect(res.status).toBe(201);
      expect(res.body.description).toBe('X-Ray');
      expect(res.body.category).toBe('PROCEDURE');
      expect(res.body.quantity).toBe(1);
      expect(Number(res.body.unitPrice)).toBe(200.00);
      expect(Number(res.body.total)).toBe(200.00);
    });

    it('computes total as quantity * unitPrice', async () => {
      const patient = await createPatient();
      const bill = await createBill(patient.id);

      const res = await request.post('/api/bill-line-items').send({
        billId: bill.id,
        description: 'Medication',
        category: 'MEDICATION',
        quantity: 3,
        unitPrice: 25.00,
      });

      expect(res.status).toBe(201);
      expect(Number(res.body.total)).toBe(75.00);
    });

    it('auto-recalculates bill total after creating line item', async () => {
      const patient = await createPatient();
      const bill = await createBill(patient.id);

      await request.post('/api/bill-line-items').send({
        billId: bill.id,
        description: 'Room charge',
        category: 'ROOM',
        quantity: 5,
        unitPrice: 100.00,
      });

      const billRes = await request.get(`/api/bills/${bill.id}`);
      expect(Number(billRes.body.totalAmount)).toBe(500.00);
    });

    it('returns 400 for invalid category', async () => {
      const patient = await createPatient();
      const bill = await createBill(patient.id);

      const res = await request.post('/api/bill-line-items').send({
        billId: bill.id,
        description: 'Invalid',
        category: 'INVALID_CAT',
        quantity: 1,
        unitPrice: 10.00,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation error');
    });

    it('returns 400 for zero quantity', async () => {
      const patient = await createPatient();
      const bill = await createBill(patient.id);

      const res = await request.post('/api/bill-line-items').send({
        billId: bill.id,
        description: 'Zero',
        category: 'OTHER',
        quantity: 0,
        unitPrice: 10.00,
      });
      expect(res.status).toBe(400);
    });
  });

  describe('DELETE /api/bill-line-items/:id', () => {
    it('deletes line item and recalculates bill total', async () => {
      const patient = await createPatient();
      const bill = await createBill(patient.id);

      // Create two line items
      const item1Res = await request.post('/api/bill-line-items').send({
        billId: bill.id,
        description: 'Item 1',
        category: 'CONSULTATION',
        quantity: 1,
        unitPrice: 100.00,
      });
      await request.post('/api/bill-line-items').send({
        billId: bill.id,
        description: 'Item 2',
        category: 'LAB',
        quantity: 1,
        unitPrice: 50.00,
      });

      // Delete first item
      const delRes = await request.delete(`/api/bill-line-items/${item1Res.body.id}`);
      expect(delRes.status).toBe(204);

      // Bill total should only have item 2
      const billRes = await request.get(`/api/bills/${bill.id}`);
      expect(Number(billRes.body.totalAmount)).toBe(50.00);
    });

    it('returns 404 for non-existent line item', async () => {
      const res = await request.delete('/api/bill-line-items/99999');
      expect(res.status).toBe(404);
    });
  });
});
