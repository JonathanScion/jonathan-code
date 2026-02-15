// ─── Pagination ─────────────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// ─── Simple CRUD ────────────────────────────────────────────
export interface Department {
  id: number;
  name: string;
  description: string | null;
  phone: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Room {
  id: number;
  number: string;
  floor: number;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count?: { beds: number };
  beds?: Bed[];
}

export interface Medication {
  id: number;
  name: string;
  genericName: string | null;
  manufacturer: string | null;
  dosageForm: string;
  strength: string;
  price: number;
  requiresRx: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InsurancePlan {
  id: number;
  name: string;
  provider: string;
  type: string;
  coverageLevel: string;
  monthlyPremium: number;
  deductible: number;
  maxCoverage: number;
  createdAt: string;
  updatedAt: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { inventoryItems: number };
}

// ─── Rich Forms ─────────────────────────────────────────────
export interface Patient {
  id: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  ssn: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  emergencyRelation: string | null;
  bloodType: string | null;
  allergies: string | null;
  medicalNotes: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { visits: number; appointments: number };
  insurances?: PatientInsurance[];
  visits?: Visit[];
  appointments?: Appointment[];
  bills?: Bill[];
}

export interface Doctor {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  licenseNumber: string;
  specialization: string;
  yearsExperience: number;
  consultationFee: number;
  createdAt: string;
  updatedAt: string;
  _count?: { appointments: number };
  departments?: DoctorDepartment[];
}

// ─── Parent → Child ─────────────────────────────────────────
export interface Bed {
  id: number;
  number: string;
  type: string;
  status: string;
  roomId: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: number;
  supplierId: number;
  medicationId: number | null;
  name: string;
  quantity: number;
  unit: string;
  reorderLevel: number;
  unitCost: number;
  expiryDate: string | null;
  createdAt: string;
  updatedAt: string;
  supplier?: Supplier;
  medication?: Medication;
}

export interface Staff {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: string;
  departmentId: number;
  hireDate: string;
  salary: number;
  createdAt: string;
  updatedAt: string;
  department?: Department;
}

// ─── Many-to-Many ───────────────────────────────────────────
export interface PatientInsurance {
  id: number;
  patientId: number;
  insurancePlanId: number;
  policyNumber: string;
  startDate: string;
  endDate: string | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
  insurancePlan?: InsurancePlan;
}

export interface DoctorDepartment {
  id: number;
  doctorId: number;
  departmentId: number;
  isPrimary: boolean;
  startDate: string;
  createdAt: string;
  updatedAt: string;
  department?: Department;
}

// ─── Status Workflow ────────────────────────────────────────
export interface Appointment {
  id: number;
  patientId: number;
  doctorId: number;
  dateTime: string;
  duration: number;
  type: string;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  patient?: Patient;
  doctor?: Doctor;
}

export interface Admission {
  id: number;
  patientId: number;
  doctorId: number;
  roomId: number;
  bedId: number | null;
  admitDate: string;
  dischargeDate: string | null;
  status: string;
  reason: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  patient?: Patient;
  doctor?: Doctor;
  room?: Room;
  bed?: Bed;
}

// ─── Deep Nesting ───────────────────────────────────────────
export interface Visit {
  id: number;
  patientId: number;
  doctorId: number;
  visitDate: string;
  chiefComplaint: string | null;
  vitalSigns: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  patient?: Patient;
  doctor?: Doctor;
  diagnoses?: Diagnosis[];
  labOrders?: LabOrder[];
  prescriptions?: Prescription[];
}

export interface Diagnosis {
  id: number;
  visitId: number;
  code: string;
  description: string;
  type: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LabOrder {
  id: number;
  visitId: number;
  testName: string;
  category: string;
  priority: string;
  status: string;
  orderedAt: string;
  completedAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  results?: LabResult[];
}

export interface LabResult {
  id: number;
  labOrderId: number;
  parameter: string;
  value: string;
  unit: string | null;
  normalRange: string | null;
  isAbnormal: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── 3-Level Deep ───────────────────────────────────────────
export interface Prescription {
  id: number;
  visitId: number;
  doctorId: number;
  date: string;
  notes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  doctor?: Doctor;
  items?: PrescriptionItem[];
}

export interface PrescriptionItem {
  id: number;
  prescriptionId: number;
  medicationId: number;
  dosage: string;
  frequency: string;
  duration: string;
  quantity: number;
  instructions: string | null;
  createdAt: string;
  updatedAt: string;
  medication?: Medication;
}

// ─── Computed ───────────────────────────────────────────────
export interface Bill {
  id: number;
  patientId: number;
  visitId: number | null;
  date: string;
  dueDate: string | null;
  totalAmount: number;
  paidAmount: number;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  patient?: Patient;
  lineItems?: BillLineItem[];
}

export interface BillLineItem {
  id: number;
  billId: number;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  total: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Dashboard ──────────────────────────────────────────────
export interface DashboardStats {
  patientCount: number;
  todayAppointments: number;
  bedOccupancy: { occupied: number; total: number };
  pendingLabOrders: number;
  outstandingBills: { count: number; total: number };
}
