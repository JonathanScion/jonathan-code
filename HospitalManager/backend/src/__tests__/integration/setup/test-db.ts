import { PrismaClient } from '@prisma/client';
import { beforeEach, afterAll } from 'vitest';

const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5434/hospital_test';

process.env.DATABASE_URL = testDatabaseUrl;

const prisma = new PrismaClient({
  datasources: { db: { url: testDatabaseUrl } },
});

// Clean all tables before each test (reverse dependency order)
beforeEach(async () => {
  await prisma.$transaction([
    prisma.labResult.deleteMany(),
    prisma.labOrder.deleteMany(),
    prisma.prescriptionItem.deleteMany(),
    prisma.prescription.deleteMany(),
    prisma.diagnosis.deleteMany(),
    prisma.billLineItem.deleteMany(),
    prisma.bill.deleteMany(),
    prisma.visit.deleteMany(),
    prisma.admission.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.patientInsurance.deleteMany(),
    prisma.doctorDepartment.deleteMany(),
    prisma.inventoryItem.deleteMany(),
    prisma.staff.deleteMany(),
    prisma.bed.deleteMany(),
    prisma.patient.deleteMany(),
    prisma.doctor.deleteMany(),
    prisma.room.deleteMany(),
    prisma.department.deleteMany(),
    prisma.medication.deleteMany(),
    prisma.insurancePlan.deleteMany(),
    prisma.supplier.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
