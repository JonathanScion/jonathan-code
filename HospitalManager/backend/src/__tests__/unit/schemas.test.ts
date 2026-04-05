import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Recreate the schemas exactly as they appear in route files
// to test validation logic in isolation

const departmentSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
});

const roomSchema = z.object({
  number: z.string().min(1).max(10),
  floor: z.number().int().min(0).max(50),
  type: z.enum(['WARD', 'PRIVATE', 'ICU', 'OPERATING', 'EMERGENCY']),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'MAINTENANCE']).optional(),
});

const medicationSchema = z.object({
  name: z.string().min(1).max(200),
  genericName: z.string().max(200).optional().nullable(),
  manufacturer: z.string().max(200).optional().nullable(),
  dosageForm: z.enum(['TABLET', 'CAPSULE', 'INJECTION', 'SYRUP', 'CREAM', 'INHALER']),
  strength: z.string().min(1).max(50),
  price: z.number().min(0),
  requiresRx: z.boolean().optional(),
});

const appointmentSchema = z.object({
  patientId: z.number().int().positive(),
  doctorId: z.number().int().positive(),
  dateTime: z.string().datetime({ offset: true }),
  duration: z.number().int().min(5).max(480),
  type: z.enum(['CONSULTATION', 'FOLLOW_UP', 'EMERGENCY', 'ROUTINE']),
  status: z.enum(['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

const patientSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.coerce.date(),
  gender: z.enum(['MALE', 'FEMALE', 'OTHER']),
  ssn: z.string().max(11).optional().nullable(),
  email: z.string().email().optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  bloodType: z.enum(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']).optional().nullable(),
});

const billSchema = z.object({
  patientId: z.number().int().positive(),
  visitId: z.number().int().positive().optional().nullable(),
  date: z.string().datetime({ offset: true }).or(z.string().date()),
  dueDate: z.string().datetime({ offset: true }).or(z.string().date()).optional().nullable(),
  status: z.enum(['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED']).optional(),
  notes: z.string().max(2000).optional().nullable(),
});

const billLineItemSchema = z.object({
  billId: z.number().int().positive(),
  description: z.string().min(1).max(500),
  category: z.enum(['CONSULTATION', 'PROCEDURE', 'MEDICATION', 'LAB', 'ROOM', 'OTHER']),
  quantity: z.number().int().positive(),
  unitPrice: z.number().min(0),
});

describe('departmentSchema', () => {
  it('accepts valid department', () => {
    expect(() => departmentSchema.parse({ name: 'Cardiology' })).not.toThrow();
  });

  it('accepts optional fields', () => {
    const result = departmentSchema.parse({ name: 'Neuro', description: 'Brain', phone: '555-0100' });
    expect(result.description).toBe('Brain');
  });

  it('rejects empty name', () => {
    expect(() => departmentSchema.parse({ name: '' })).toThrow();
  });

  it('rejects name over 100 chars', () => {
    expect(() => departmentSchema.parse({ name: 'x'.repeat(101) })).toThrow();
  });

  it('accepts null optional fields', () => {
    const result = departmentSchema.parse({ name: 'Test', description: null, phone: null });
    expect(result.description).toBeNull();
  });
});

describe('roomSchema', () => {
  it('accepts valid room', () => {
    expect(() => roomSchema.parse({ number: 'R101', floor: 1, type: 'WARD' })).not.toThrow();
  });

  it('rejects invalid room type', () => {
    expect(() => roomSchema.parse({ number: 'R101', floor: 1, type: 'INVALID' })).toThrow();
  });

  it('rejects negative floor', () => {
    expect(() => roomSchema.parse({ number: 'R101', floor: -1, type: 'WARD' })).toThrow();
  });

  it('rejects floor over 50', () => {
    expect(() => roomSchema.parse({ number: 'R101', floor: 51, type: 'WARD' })).toThrow();
  });

  it('accepts all valid room types', () => {
    const types = ['WARD', 'PRIVATE', 'ICU', 'OPERATING', 'EMERGENCY'];
    types.forEach(type => {
      expect(() => roomSchema.parse({ number: 'R1', floor: 0, type })).not.toThrow();
    });
  });
});

describe('medicationSchema', () => {
  it('accepts valid medication', () => {
    const data = { name: 'Aspirin', dosageForm: 'TABLET', strength: '500mg', price: 9.99 };
    expect(() => medicationSchema.parse(data)).not.toThrow();
  });

  it('rejects negative price', () => {
    const data = { name: 'Aspirin', dosageForm: 'TABLET', strength: '500mg', price: -1 };
    expect(() => medicationSchema.parse(data)).toThrow();
  });

  it('accepts zero price', () => {
    const data = { name: 'Sample', dosageForm: 'TABLET', strength: '10mg', price: 0 };
    expect(() => medicationSchema.parse(data)).not.toThrow();
  });

  it('rejects invalid dosage form', () => {
    const data = { name: 'Test', dosageForm: 'PILL', strength: '10mg', price: 1 };
    expect(() => medicationSchema.parse(data)).toThrow();
  });
});

describe('appointmentSchema', () => {
  const validAppointment = {
    patientId: 1,
    doctorId: 1,
    dateTime: '2024-06-15T10:00:00+00:00',
    duration: 30,
    type: 'CONSULTATION',
  };

  it('accepts valid appointment', () => {
    expect(() => appointmentSchema.parse(validAppointment)).not.toThrow();
  });

  it('rejects duration under 5 minutes', () => {
    expect(() => appointmentSchema.parse({ ...validAppointment, duration: 4 })).toThrow();
  });

  it('rejects duration over 480 minutes', () => {
    expect(() => appointmentSchema.parse({ ...validAppointment, duration: 481 })).toThrow();
  });

  it('rejects invalid appointment type', () => {
    expect(() => appointmentSchema.parse({ ...validAppointment, type: 'SURGERY' })).toThrow();
  });

  it('accepts all valid types', () => {
    ['CONSULTATION', 'FOLLOW_UP', 'EMERGENCY', 'ROUTINE'].forEach(type => {
      expect(() => appointmentSchema.parse({ ...validAppointment, type })).not.toThrow();
    });
  });

  it('rejects non-positive patientId', () => {
    expect(() => appointmentSchema.parse({ ...validAppointment, patientId: 0 })).toThrow();
  });
});

describe('patientSchema', () => {
  const validPatient = {
    firstName: 'John',
    lastName: 'Doe',
    dateOfBirth: '1990-01-01',
    gender: 'MALE',
  };

  it('accepts valid patient with minimal fields', () => {
    expect(() => patientSchema.parse(validPatient)).not.toThrow();
  });

  it('coerces date string to Date object', () => {
    const result = patientSchema.parse(validPatient);
    expect(result.dateOfBirth).toBeInstanceOf(Date);
  });

  it('rejects invalid gender', () => {
    expect(() => patientSchema.parse({ ...validPatient, gender: 'INVALID' })).toThrow();
  });

  it('rejects invalid email format', () => {
    expect(() => patientSchema.parse({ ...validPatient, email: 'not-an-email' })).toThrow();
  });

  it('accepts valid blood types', () => {
    ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].forEach(bt => {
      expect(() => patientSchema.parse({ ...validPatient, bloodType: bt })).not.toThrow();
    });
  });

  it('rejects invalid blood type', () => {
    expect(() => patientSchema.parse({ ...validPatient, bloodType: 'C+' })).toThrow();
  });
});

describe('billSchema', () => {
  it('accepts valid bill', () => {
    expect(() => billSchema.parse({ patientId: 1, date: '2024-01-15' })).not.toThrow();
  });

  it('accepts date with offset', () => {
    expect(() => billSchema.parse({ patientId: 1, date: '2024-01-15T10:00:00+00:00' })).not.toThrow();
  });

  it('rejects non-positive patientId', () => {
    expect(() => billSchema.parse({ patientId: 0, date: '2024-01-15' })).toThrow();
  });
});

describe('billLineItemSchema', () => {
  const valid = { billId: 1, description: 'Consultation fee', category: 'CONSULTATION', quantity: 1, unitPrice: 150 };

  it('accepts valid line item', () => {
    expect(() => billLineItemSchema.parse(valid)).not.toThrow();
  });

  it('rejects zero quantity', () => {
    expect(() => billLineItemSchema.parse({ ...valid, quantity: 0 })).toThrow();
  });

  it('rejects invalid category', () => {
    expect(() => billLineItemSchema.parse({ ...valid, category: 'INVALID' })).toThrow();
  });

  it('accepts all valid categories', () => {
    ['CONSULTATION', 'PROCEDURE', 'MEDICATION', 'LAB', 'ROOM', 'OTHER'].forEach(cat => {
      expect(() => billLineItemSchema.parse({ ...valid, category: cat })).not.toThrow();
    });
  });
});
