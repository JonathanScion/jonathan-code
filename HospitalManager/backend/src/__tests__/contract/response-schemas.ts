import { z } from 'zod';

// Base timestamp fields
const timestamps = {
  createdAt: z.string().datetime({ offset: true }).or(z.string()),
  updatedAt: z.string().datetime({ offset: true }).or(z.string()),
};

// ─── Pagination ─────────────────────────────────────────────
export const PaginationSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  total: z.number().int().min(0),
  totalPages: z.number().int().min(0),
});

export function PaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    pagination: PaginationSchema,
  });
}

// ─── Simple CRUD ────────────────────────────────────────────
export const DepartmentSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  description: z.string().nullable(),
  phone: z.string().nullable(),
  ...timestamps,
});

export const RoomSchema = z.object({
  id: z.number().int(),
  number: z.string(),
  floor: z.number().int(),
  type: z.string(),
  status: z.string(),
  ...timestamps,
  _count: z.object({ beds: z.number().int() }).optional(),
  beds: z.array(z.any()).optional(),
});

export const MedicationSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  genericName: z.string().nullable(),
  manufacturer: z.string().nullable(),
  dosageForm: z.string(),
  strength: z.string(),
  price: z.any(), // Decimal comes back as string or number
  requiresRx: z.boolean(),
  ...timestamps,
});

export const InsurancePlanSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  provider: z.string(),
  type: z.string(),
  coverageLevel: z.string(),
  monthlyPremium: z.any(),
  deductible: z.any(),
  maxCoverage: z.any(),
  ...timestamps,
});

export const SupplierSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  contact: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  ...timestamps,
});

// ─── Rich Forms ─────────────────────────────────────────────
const PersonRefSchema = z.object({
  id: z.number().int(),
  firstName: z.string(),
  lastName: z.string(),
});

export const PatientSchema = z.object({
  id: z.number().int(),
  firstName: z.string(),
  lastName: z.string(),
  dateOfBirth: z.string(),
  gender: z.string(),
  ssn: z.string().nullable(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zipCode: z.string().nullable(),
  emergencyName: z.string().nullable(),
  emergencyPhone: z.string().nullable(),
  emergencyRelation: z.string().nullable(),
  bloodType: z.string().nullable(),
  allergies: z.string().nullable(),
  medicalNotes: z.string().nullable(),
  ...timestamps,
  _count: z.object({ visits: z.number(), appointments: z.number() }).optional(),
});

export const DoctorSchema = z.object({
  id: z.number().int(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  licenseNumber: z.string(),
  specialization: z.string(),
  yearsExperience: z.number().int(),
  consultationFee: z.any(),
  ...timestamps,
});

// ─── Status Workflow ────────────────────────────────────────
export const AppointmentSchema = z.object({
  id: z.number().int(),
  patientId: z.number().int(),
  doctorId: z.number().int(),
  dateTime: z.string(),
  duration: z.number().int(),
  type: z.string(),
  status: z.string(),
  notes: z.string().nullable(),
  ...timestamps,
  patient: PersonRefSchema.optional(),
  doctor: PersonRefSchema.optional(),
});

export const AdmissionSchema = z.object({
  id: z.number().int(),
  patientId: z.number().int(),
  doctorId: z.number().int(),
  roomId: z.number().int(),
  bedId: z.number().int().nullable(),
  admitDate: z.string(),
  dischargeDate: z.string().nullable(),
  status: z.string(),
  reason: z.string().nullable(),
  notes: z.string().nullable(),
  ...timestamps,
});

// ─── Deep Nesting ───────────────────────────────────────────
export const VisitSchema = z.object({
  id: z.number().int(),
  patientId: z.number().int(),
  doctorId: z.number().int(),
  visitDate: z.string(),
  chiefComplaint: z.string().nullable(),
  vitalSigns: z.string().nullable(),
  notes: z.string().nullable(),
  ...timestamps,
  patient: PersonRefSchema.optional(),
  doctor: PersonRefSchema.optional(),
});

// ─── Computed ───────────────────────────────────────────────
export const BillSchema = z.object({
  id: z.number().int(),
  patientId: z.number().int(),
  visitId: z.number().int().nullable(),
  date: z.string(),
  dueDate: z.string().nullable(),
  totalAmount: z.any(),
  paidAmount: z.any(),
  status: z.string(),
  notes: z.string().nullable(),
  ...timestamps,
  patient: PersonRefSchema.optional(),
});

export const BillLineItemSchema = z.object({
  id: z.number().int(),
  billId: z.number().int(),
  description: z.string(),
  category: z.string(),
  quantity: z.number().int(),
  unitPrice: z.any(),
  total: z.any(),
  ...timestamps,
});

// ─── Dashboard ──────────────────────────────────────────────
export const DashboardStatsSchema = z.object({
  patientCount: z.number().int().min(0),
  todayAppointments: z.number().int().min(0),
  bedOccupancy: z.object({
    occupied: z.number().int().min(0),
    total: z.number().int().min(0),
  }),
  pendingLabOrders: z.number().int().min(0),
  outstandingBills: z.object({
    count: z.number().int().min(0),
    total: z.number().min(0),
  }),
});
