import { prisma } from './test-db';

export async function createDepartment(overrides: Record<string, any> = {}) {
  return prisma.department.create({
    data: {
      name: `Department ${Date.now()}`,
      description: 'Test department',
      phone: '555-0100',
      ...overrides,
    },
  });
}

export async function createRoom(overrides: Record<string, any> = {}) {
  return prisma.room.create({
    data: {
      number: `R${Date.now()}`,
      floor: 1,
      type: 'WARD',
      status: 'AVAILABLE',
      ...overrides,
    },
  });
}

export async function createBed(roomId: number, overrides: Record<string, any> = {}) {
  return prisma.bed.create({
    data: {
      number: `B${Date.now()}`,
      type: 'STANDARD',
      status: 'AVAILABLE',
      roomId,
      ...overrides,
    },
  });
}

export async function createPatient(overrides: Record<string, any> = {}) {
  return prisma.patient.create({
    data: {
      firstName: 'John',
      lastName: `Doe${Date.now()}`,
      dateOfBirth: new Date('1990-01-01'),
      gender: 'MALE',
      email: `john${Date.now()}@test.com`,
      phone: '555-0200',
      ...overrides,
    },
  });
}

export async function createDoctor(overrides: Record<string, any> = {}) {
  return prisma.doctor.create({
    data: {
      firstName: 'Dr. Jane',
      lastName: `Smith${Date.now()}`,
      email: `jane${Date.now()}@hospital.com`,
      phone: '555-0300',
      licenseNumber: `LIC${Date.now()}`,
      specialization: 'General Medicine',
      yearsExperience: 10,
      consultationFee: 150.00,
      ...overrides,
    },
  });
}

export async function createMedication(overrides: Record<string, any> = {}) {
  return prisma.medication.create({
    data: {
      name: `Medication ${Date.now()}`,
      genericName: 'Test Generic',
      dosageForm: 'TABLET',
      strength: '500mg',
      price: 9.99,
      requiresRx: true,
      ...overrides,
    },
  });
}

export async function createInsurancePlan(overrides: Record<string, any> = {}) {
  return prisma.insurancePlan.create({
    data: {
      name: `Plan ${Date.now()}`,
      provider: 'Test Insurance Co.',
      type: 'PPO',
      coverageLevel: 'STANDARD',
      monthlyPremium: 250.00,
      deductible: 1000.00,
      maxCoverage: 500000.00,
      ...overrides,
    },
  });
}

export async function createSupplier(overrides: Record<string, any> = {}) {
  return prisma.supplier.create({
    data: {
      name: `Supplier ${Date.now()}`,
      contact: 'Test Contact',
      email: `supplier${Date.now()}@test.com`,
      phone: '555-0400',
      ...overrides,
    },
  });
}

export async function createVisit(
  patientId: number,
  doctorId: number,
  overrides: Record<string, any> = {},
) {
  return prisma.visit.create({
    data: {
      patientId,
      doctorId,
      visitDate: new Date(),
      chiefComplaint: 'Test complaint',
      ...overrides,
    },
  });
}

export async function createBill(patientId: number, overrides: Record<string, any> = {}) {
  return prisma.bill.create({
    data: {
      patientId,
      date: new Date(),
      status: 'PENDING',
      ...overrides,
    },
  });
}

export async function createAppointment(
  patientId: number,
  doctorId: number,
  overrides: Record<string, any> = {},
) {
  return prisma.appointment.create({
    data: {
      patientId,
      doctorId,
      dateTime: new Date(),
      duration: 30,
      type: 'CONSULTATION',
      status: 'SCHEDULED',
      ...overrides,
    },
  });
}

export async function createAdmission(
  patientId: number,
  doctorId: number,
  roomId: number,
  overrides: Record<string, any> = {},
) {
  return prisma.admission.create({
    data: {
      patientId,
      doctorId,
      roomId,
      admitDate: new Date(),
      status: 'ADMITTED',
      ...overrides,
    },
  });
}
