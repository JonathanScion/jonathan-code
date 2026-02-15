import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Departments
  const departments = await Promise.all([
    prisma.department.create({ data: { name: 'Emergency Medicine', description: 'Emergency and trauma care', phone: '555-0101' } }),
    prisma.department.create({ data: { name: 'Cardiology', description: 'Heart and cardiovascular system', phone: '555-0102' } }),
    prisma.department.create({ data: { name: 'Orthopedics', description: 'Bones, joints, and muscles', phone: '555-0103' } }),
    prisma.department.create({ data: { name: 'Pediatrics', description: 'Children healthcare', phone: '555-0104' } }),
    prisma.department.create({ data: { name: 'Neurology', description: 'Brain and nervous system', phone: '555-0105' } }),
    prisma.department.create({ data: { name: 'Oncology', description: 'Cancer treatment', phone: '555-0106' } }),
    prisma.department.create({ data: { name: 'Radiology', description: 'Medical imaging', phone: '555-0107' } }),
    prisma.department.create({ data: { name: 'General Surgery', description: 'Surgical procedures', phone: '555-0108' } }),
  ]);
  console.log(`Created ${departments.length} departments`);

  // Rooms
  const rooms = await Promise.all([
    prisma.room.create({ data: { number: '101', floor: 1, type: 'EMERGENCY', status: 'AVAILABLE' } }),
    prisma.room.create({ data: { number: '102', floor: 1, type: 'EMERGENCY', status: 'AVAILABLE' } }),
    prisma.room.create({ data: { number: '201', floor: 2, type: 'WARD', status: 'AVAILABLE' } }),
    prisma.room.create({ data: { number: '202', floor: 2, type: 'WARD', status: 'OCCUPIED' } }),
    prisma.room.create({ data: { number: '203', floor: 2, type: 'WARD', status: 'AVAILABLE' } }),
    prisma.room.create({ data: { number: '301', floor: 3, type: 'PRIVATE', status: 'AVAILABLE' } }),
    prisma.room.create({ data: { number: '302', floor: 3, type: 'PRIVATE', status: 'OCCUPIED' } }),
    prisma.room.create({ data: { number: '303', floor: 3, type: 'PRIVATE', status: 'AVAILABLE' } }),
    prisma.room.create({ data: { number: '401', floor: 4, type: 'ICU', status: 'AVAILABLE' } }),
    prisma.room.create({ data: { number: '402', floor: 4, type: 'ICU', status: 'OCCUPIED' } }),
    prisma.room.create({ data: { number: '501', floor: 5, type: 'OPERATING', status: 'AVAILABLE' } }),
    prisma.room.create({ data: { number: '502', floor: 5, type: 'OPERATING', status: 'MAINTENANCE' } }),
    prisma.room.create({ data: { number: '204', floor: 2, type: 'WARD', status: 'AVAILABLE' } }),
    prisma.room.create({ data: { number: '205', floor: 2, type: 'WARD', status: 'AVAILABLE' } }),
    prisma.room.create({ data: { number: '304', floor: 3, type: 'PRIVATE', status: 'AVAILABLE' } }),
    prisma.room.create({ data: { number: '403', floor: 4, type: 'ICU', status: 'AVAILABLE' } }),
    prisma.room.create({ data: { number: '206', floor: 2, type: 'WARD', status: 'AVAILABLE' } }),
    prisma.room.create({ data: { number: '207', floor: 2, type: 'WARD', status: 'AVAILABLE' } }),
    prisma.room.create({ data: { number: '305', floor: 3, type: 'PRIVATE', status: 'AVAILABLE' } }),
    prisma.room.create({ data: { number: '503', floor: 5, type: 'OPERATING', status: 'AVAILABLE' } }),
  ]);
  console.log(`Created ${rooms.length} rooms`);

  // Beds (2-4 per room for wards/ICU, 1 for private)
  const beds = [];
  for (const room of rooms) {
    const bedCount = room.type === 'WARD' ? 4 : room.type === 'ICU' ? 2 : room.type === 'PRIVATE' ? 1 : 0;
    for (let i = 1; i <= bedCount; i++) {
      const bedType = room.type === 'ICU' ? 'ICU' : i === 1 ? 'ELECTRIC' : 'STANDARD';
      beds.push(await prisma.bed.create({
        data: { number: `${room.number}-${String.fromCharCode(64 + i)}`, type: bedType, status: 'AVAILABLE', roomId: room.id },
      }));
    }
  }
  // Mark some beds occupied
  for (let i = 0; i < 8 && i < beds.length; i++) {
    await prisma.bed.update({ where: { id: beds[i].id }, data: { status: 'OCCUPIED' } });
  }
  console.log(`Created ${beds.length} beds`);

  // Medications
  const medications = await Promise.all([
    prisma.medication.create({ data: { name: 'Amoxicillin', genericName: 'Amoxicillin', manufacturer: 'Teva', dosageForm: 'CAPSULE', strength: '500mg', price: 12.99, requiresRx: true } }),
    prisma.medication.create({ data: { name: 'Ibuprofen', genericName: 'Ibuprofen', manufacturer: 'Advil', dosageForm: 'TABLET', strength: '200mg', price: 8.99, requiresRx: false } }),
    prisma.medication.create({ data: { name: 'Lisinopril', genericName: 'Lisinopril', manufacturer: 'Merck', dosageForm: 'TABLET', strength: '10mg', price: 15.50, requiresRx: true } }),
    prisma.medication.create({ data: { name: 'Metformin', genericName: 'Metformin HCl', manufacturer: 'Bristol-Myers', dosageForm: 'TABLET', strength: '500mg', price: 11.25, requiresRx: true } }),
    prisma.medication.create({ data: { name: 'Omeprazole', genericName: 'Omeprazole', manufacturer: 'AstraZeneca', dosageForm: 'CAPSULE', strength: '20mg', price: 22.00, requiresRx: true } }),
    prisma.medication.create({ data: { name: 'Albuterol', genericName: 'Albuterol Sulfate', manufacturer: 'Ventolin', dosageForm: 'INHALER', strength: '90mcg', price: 35.00, requiresRx: true } }),
    prisma.medication.create({ data: { name: 'Morphine', genericName: 'Morphine Sulfate', manufacturer: 'Purdue', dosageForm: 'INJECTION', strength: '10mg/ml', price: 45.00, requiresRx: true } }),
    prisma.medication.create({ data: { name: 'Hydrocortisone', genericName: 'Hydrocortisone', manufacturer: 'Pfizer', dosageForm: 'CREAM', strength: '1%', price: 9.99, requiresRx: false } }),
    prisma.medication.create({ data: { name: 'Cephalexin', genericName: 'Cephalexin', manufacturer: 'Lupin', dosageForm: 'CAPSULE', strength: '250mg', price: 14.50, requiresRx: true } }),
    prisma.medication.create({ data: { name: 'Acetaminophen', genericName: 'Acetaminophen', manufacturer: 'Tylenol', dosageForm: 'SYRUP', strength: '160mg/5ml', price: 7.50, requiresRx: false } }),
  ]);
  console.log(`Created ${medications.length} medications`);

  // Insurance Plans
  const insurancePlans = await Promise.all([
    prisma.insurancePlan.create({ data: { name: 'BlueCross Basic', provider: 'BlueCross BlueShield', type: 'HMO', coverageLevel: 'BASIC', monthlyPremium: 350, deductible: 5000, maxCoverage: 100000 } }),
    prisma.insurancePlan.create({ data: { name: 'BlueCross Premium', provider: 'BlueCross BlueShield', type: 'PPO', coverageLevel: 'PREMIUM', monthlyPremium: 750, deductible: 1500, maxCoverage: 500000 } }),
    prisma.insurancePlan.create({ data: { name: 'Aetna Standard', provider: 'Aetna', type: 'PPO', coverageLevel: 'STANDARD', monthlyPremium: 500, deductible: 3000, maxCoverage: 250000 } }),
    prisma.insurancePlan.create({ data: { name: 'United Health Basic', provider: 'UnitedHealth', type: 'HMO', coverageLevel: 'BASIC', monthlyPremium: 300, deductible: 6000, maxCoverage: 80000 } }),
    prisma.insurancePlan.create({ data: { name: 'Cigna Premium', provider: 'Cigna', type: 'EPO', coverageLevel: 'PREMIUM', monthlyPremium: 800, deductible: 1000, maxCoverage: 1000000 } }),
    prisma.insurancePlan.create({ data: { name: 'Kaiser Standard', provider: 'Kaiser Permanente', type: 'HMO', coverageLevel: 'STANDARD', monthlyPremium: 450, deductible: 2500, maxCoverage: 200000 } }),
  ]);
  console.log(`Created ${insurancePlans.length} insurance plans`);

  // Suppliers
  const suppliers = await Promise.all([
    prisma.supplier.create({ data: { name: 'MedSupply Corp', contact: 'John Smith', email: 'orders@medsupply.com', phone: '555-1001', address: '123 Medical Dr, Suite 100' } }),
    prisma.supplier.create({ data: { name: 'PharmaDist Inc', contact: 'Jane Doe', email: 'sales@pharmadist.com', phone: '555-1002', address: '456 Pharma Ave' } }),
    prisma.supplier.create({ data: { name: 'Global Health Supplies', contact: 'Bob Wilson', email: 'info@globalhealth.com', phone: '555-1003', address: '789 Health Blvd' } }),
    prisma.supplier.create({ data: { name: 'SurgiTech Equipment', contact: 'Alice Brown', email: 'orders@surgitech.com', phone: '555-1004', address: '321 Surgical Way' } }),
  ]);
  console.log(`Created ${suppliers.length} suppliers`);

  // Inventory Items
  const inventoryItems = [];
  for (let i = 0; i < medications.length; i++) {
    const supplier = suppliers[i % suppliers.length];
    inventoryItems.push(await prisma.inventoryItem.create({
      data: {
        supplierId: supplier.id, medicationId: medications[i].id,
        name: medications[i].name, quantity: 50 + Math.floor(Math.random() * 200),
        unit: 'BOXES', reorderLevel: 20, unitCost: Number(medications[i].price) * 0.6,
        expiryDate: new Date(2027, Math.floor(Math.random() * 12), 1),
      },
    }));
  }
  console.log(`Created ${inventoryItems.length} inventory items`);

  // Doctors
  const doctorData = [
    { firstName: 'Sarah', lastName: 'Chen', email: 'sarah.chen@hospital.com', phone: '555-2001', licenseNumber: 'MD-10001', specialization: 'Cardiology', yearsExperience: 15, consultationFee: 250 },
    { firstName: 'James', lastName: 'Wilson', email: 'james.wilson@hospital.com', phone: '555-2002', licenseNumber: 'MD-10002', specialization: 'Orthopedics', yearsExperience: 12, consultationFee: 200 },
    { firstName: 'Emily', lastName: 'Roberts', email: 'emily.roberts@hospital.com', phone: '555-2003', licenseNumber: 'MD-10003', specialization: 'Pediatrics', yearsExperience: 8, consultationFee: 180 },
    { firstName: 'Michael', lastName: 'Park', email: 'michael.park@hospital.com', phone: '555-2004', licenseNumber: 'MD-10004', specialization: 'Neurology', yearsExperience: 20, consultationFee: 300 },
    { firstName: 'Lisa', lastName: 'Thompson', email: 'lisa.thompson@hospital.com', phone: '555-2005', licenseNumber: 'MD-10005', specialization: 'Emergency Medicine', yearsExperience: 10, consultationFee: 220 },
    { firstName: 'David', lastName: 'Kim', email: 'david.kim@hospital.com', phone: '555-2006', licenseNumber: 'MD-10006', specialization: 'Oncology', yearsExperience: 18, consultationFee: 350 },
    { firstName: 'Amanda', lastName: 'Garcia', email: 'amanda.garcia@hospital.com', phone: '555-2007', licenseNumber: 'MD-10007', specialization: 'Radiology', yearsExperience: 7, consultationFee: 200 },
    { firstName: 'Robert', lastName: 'Johnson', email: 'robert.johnson@hospital.com', phone: '555-2008', licenseNumber: 'MD-10008', specialization: 'General Surgery', yearsExperience: 22, consultationFee: 400 },
    { firstName: 'Maria', lastName: 'Lopez', email: 'maria.lopez@hospital.com', phone: '555-2009', licenseNumber: 'MD-10009', specialization: 'Cardiology', yearsExperience: 5, consultationFee: 180 },
    { firstName: 'Thomas', lastName: 'Brown', email: 'thomas.brown@hospital.com', phone: '555-2010', licenseNumber: 'MD-10010', specialization: 'Pediatrics', yearsExperience: 14, consultationFee: 200 },
  ];
  const doctors = await Promise.all(doctorData.map(d => prisma.doctor.create({ data: d })));
  console.log(`Created ${doctors.length} doctors`);

  // Doctor-Department links
  for (let i = 0; i < doctors.length; i++) {
    const deptIndex = i % departments.length;
    await prisma.doctorDepartment.create({
      data: { doctorId: doctors[i].id, departmentId: departments[deptIndex].id, isPrimary: true },
    });
    if (i % 3 === 0) {
      const secondDept = (deptIndex + 1) % departments.length;
      await prisma.doctorDepartment.create({
        data: { doctorId: doctors[i].id, departmentId: departments[secondDept].id, isPrimary: false },
      });
    }
  }
  console.log('Created doctor-department links');

  // Staff
  const staffData = [
    { firstName: 'Nancy', lastName: 'White', email: 'nancy.w@hospital.com', role: 'NURSE', salary: 65000 },
    { firstName: 'Carlos', lastName: 'Rivera', email: 'carlos.r@hospital.com', role: 'NURSE', salary: 62000 },
    { firstName: 'Priya', lastName: 'Patel', email: 'priya.p@hospital.com', role: 'TECHNICIAN', salary: 55000 },
    { firstName: 'Tom', lastName: 'Harris', email: 'tom.h@hospital.com', role: 'RECEPTIONIST', salary: 38000 },
    { firstName: 'Sue', lastName: 'Miller', email: 'sue.m@hospital.com', role: 'ADMIN', salary: 48000 },
    { firstName: 'Kevin', lastName: 'Lee', email: 'kevin.l@hospital.com', role: 'TECHNICIAN', salary: 52000 },
    { firstName: 'Rachel', lastName: 'Green', email: 'rachel.g@hospital.com', role: 'NURSE', salary: 68000 },
    { firstName: 'Mike', lastName: 'Taylor', email: 'mike.t@hospital.com', role: 'JANITOR', salary: 32000 },
  ];
  await Promise.all(staffData.map((s, i) =>
    prisma.staff.create({ data: { ...s, departmentId: departments[i % departments.length].id } })
  ));
  console.log('Created staff');

  // Patients
  const patientData = [
    { firstName: 'Alice', lastName: 'Anderson', dateOfBirth: new Date('1985-03-15'), gender: 'FEMALE', email: 'alice.a@email.com', phone: '555-3001', bloodType: 'A+', city: 'Springfield', state: 'IL', zipCode: '62701' },
    { firstName: 'Bob', lastName: 'Baker', dateOfBirth: new Date('1990-07-22'), gender: 'MALE', email: 'bob.b@email.com', phone: '555-3002', bloodType: 'O+', city: 'Springfield', state: 'IL', zipCode: '62702' },
    { firstName: 'Carol', lastName: 'Clark', dateOfBirth: new Date('1978-11-08'), gender: 'FEMALE', email: 'carol.c@email.com', phone: '555-3003', bloodType: 'B-', allergies: 'Penicillin', city: 'Chicago', state: 'IL', zipCode: '60601' },
    { firstName: 'Daniel', lastName: 'Davis', dateOfBirth: new Date('1965-01-30'), gender: 'MALE', email: 'daniel.d@email.com', phone: '555-3004', bloodType: 'AB+', city: 'Chicago', state: 'IL', zipCode: '60602' },
    { firstName: 'Eva', lastName: 'Evans', dateOfBirth: new Date('2000-05-12'), gender: 'FEMALE', email: 'eva.e@email.com', phone: '555-3005', bloodType: 'O-', city: 'Naperville', state: 'IL', zipCode: '60540' },
    { firstName: 'Frank', lastName: 'Foster', dateOfBirth: new Date('1972-09-18'), gender: 'MALE', email: 'frank.f@email.com', phone: '555-3006', bloodType: 'A-', allergies: 'Sulfa drugs', city: 'Evanston', state: 'IL', zipCode: '60201' },
    { firstName: 'Grace', lastName: 'Green', dateOfBirth: new Date('1995-12-25'), gender: 'FEMALE', email: 'grace.g@email.com', phone: '555-3007', bloodType: 'B+', city: 'Aurora', state: 'IL', zipCode: '60505' },
    { firstName: 'Henry', lastName: 'Hall', dateOfBirth: new Date('1958-04-03'), gender: 'MALE', email: 'henry.h@email.com', phone: '555-3008', bloodType: 'O+', allergies: 'Latex', city: 'Joliet', state: 'IL', zipCode: '60431' },
    { firstName: 'Iris', lastName: 'Irving', dateOfBirth: new Date('1988-08-14'), gender: 'FEMALE', email: 'iris.i@email.com', phone: '555-3009', bloodType: 'A+', city: 'Rockford', state: 'IL', zipCode: '61101' },
    { firstName: 'Jack', lastName: 'Jones', dateOfBirth: new Date('2005-02-28'), gender: 'MALE', email: 'jack.j@email.com', phone: '555-3010', bloodType: 'AB-', city: 'Peoria', state: 'IL', zipCode: '61602' },
    { firstName: 'Karen', lastName: 'King', dateOfBirth: new Date('1980-06-20'), gender: 'FEMALE', email: 'karen.k@email.com', phone: '555-3011', bloodType: 'O+', city: 'Springfield', state: 'IL', zipCode: '62703' },
    { firstName: 'Leo', lastName: 'Lewis', dateOfBirth: new Date('1992-10-05'), gender: 'MALE', email: 'leo.l@email.com', phone: '555-3012', bloodType: 'B+', city: 'Chicago', state: 'IL', zipCode: '60603' },
    { firstName: 'Mia', lastName: 'Moore', dateOfBirth: new Date('1975-03-30'), gender: 'FEMALE', email: 'mia.m@email.com', phone: '555-3013', bloodType: 'A-', allergies: 'Aspirin', city: 'Champaign', state: 'IL', zipCode: '61820' },
    { firstName: 'Noah', lastName: 'Nelson', dateOfBirth: new Date('1998-07-11'), gender: 'MALE', email: 'noah.n@email.com', phone: '555-3014', bloodType: 'O-', city: 'Bloomington', state: 'IL', zipCode: '61701' },
    { firstName: 'Olivia', lastName: 'Owen', dateOfBirth: new Date('1960-12-01'), gender: 'FEMALE', email: 'olivia.o@email.com', phone: '555-3015', bloodType: 'AB+', allergies: 'Codeine', city: 'Decatur', state: 'IL', zipCode: '62521' },
    { firstName: 'Paul', lastName: 'Parker', dateOfBirth: new Date('1983-01-17'), gender: 'MALE', email: 'paul.p@email.com', phone: '555-3016', bloodType: 'A+', city: 'Springfield', state: 'IL', zipCode: '62704' },
    { firstName: 'Quinn', lastName: 'Quinn', dateOfBirth: new Date('2001-09-23'), gender: 'FEMALE', email: 'quinn.q@email.com', phone: '555-3017', bloodType: 'B-', city: 'Chicago', state: 'IL', zipCode: '60604' },
    { firstName: 'Ryan', lastName: 'Reed', dateOfBirth: new Date('1970-05-08'), gender: 'MALE', email: 'ryan.r@email.com', phone: '555-3018', bloodType: 'O+', city: 'Naperville', state: 'IL', zipCode: '60541' },
    { firstName: 'Sophie', lastName: 'Scott', dateOfBirth: new Date('1993-11-14'), gender: 'FEMALE', email: 'sophie.s@email.com', phone: '555-3019', bloodType: 'A+', city: 'Evanston', state: 'IL', zipCode: '60202' },
    { firstName: 'Tyler', lastName: 'Turner', dateOfBirth: new Date('1987-04-27'), gender: 'MALE', email: 'tyler.t@email.com', phone: '555-3020', bloodType: 'AB+', city: 'Aurora', state: 'IL', zipCode: '60506' },
    { firstName: 'Uma', lastName: 'Underwood', dateOfBirth: new Date('1976-08-09'), gender: 'FEMALE', email: 'uma.u@email.com', phone: '555-3021', bloodType: 'O-', allergies: 'Iodine', city: 'Joliet', state: 'IL', zipCode: '60432' },
    { firstName: 'Victor', lastName: 'Vance', dateOfBirth: new Date('1999-02-14'), gender: 'MALE', email: 'victor.v@email.com', phone: '555-3022', bloodType: 'B+', city: 'Rockford', state: 'IL', zipCode: '61102' },
    { firstName: 'Wendy', lastName: 'Walker', dateOfBirth: new Date('1968-06-30'), gender: 'FEMALE', email: 'wendy.w@email.com', phone: '555-3023', bloodType: 'A-', city: 'Peoria', state: 'IL', zipCode: '61603' },
    { firstName: 'Xavier', lastName: 'Xu', dateOfBirth: new Date('2003-10-19'), gender: 'MALE', email: 'xavier.x@email.com', phone: '555-3024', bloodType: 'O+', city: 'Chicago', state: 'IL', zipCode: '60605' },
    { firstName: 'Yara', lastName: 'Young', dateOfBirth: new Date('1991-01-05'), gender: 'FEMALE', email: 'yara.y@email.com', phone: '555-3025', bloodType: 'AB-', city: 'Springfield', state: 'IL', zipCode: '62705' },
    { firstName: 'Zack', lastName: 'Zhang', dateOfBirth: new Date('1982-07-16'), gender: 'MALE', email: 'zack.z@email.com', phone: '555-3026', bloodType: 'B-', allergies: 'Peanuts', city: 'Champaign', state: 'IL', zipCode: '61821' },
    { firstName: 'Amy', lastName: 'Adams', dateOfBirth: new Date('1996-03-22'), gender: 'FEMALE', email: 'amy.a@email.com', phone: '555-3027', bloodType: 'O+', city: 'Bloomington', state: 'IL', zipCode: '61702' },
    { firstName: 'Ben', lastName: 'Brooks', dateOfBirth: new Date('1974-11-11'), gender: 'MALE', email: 'ben.b@email.com', phone: '555-3028', bloodType: 'A+', city: 'Decatur', state: 'IL', zipCode: '62522' },
    { firstName: 'Chloe', lastName: 'Carter', dateOfBirth: new Date('2007-05-01'), gender: 'FEMALE', email: 'chloe.c@email.com', phone: '555-3029', bloodType: 'B+', city: 'Chicago', state: 'IL', zipCode: '60606' },
    { firstName: 'Derek', lastName: 'Dunn', dateOfBirth: new Date('1963-09-07'), gender: 'MALE', email: 'derek.d@email.com', phone: '555-3030', bloodType: 'O-', allergies: 'Morphine', city: 'Naperville', state: 'IL', zipCode: '60542' },
  ];
  const patients = await Promise.all(patientData.map(p => prisma.patient.create({ data: p })));
  console.log(`Created ${patients.length} patients`);

  // Patient-Insurance links
  for (let i = 0; i < patients.length; i++) {
    await prisma.patientInsurance.create({
      data: {
        patientId: patients[i].id,
        insurancePlanId: insurancePlans[i % insurancePlans.length].id,
        policyNumber: `POL-${100000 + i}`,
        startDate: new Date('2024-01-01'),
        isPrimary: true,
      },
    });
  }
  console.log('Created patient-insurance links');

  // Appointments (20)
  const today = new Date();
  const appointmentStatuses = ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
  const appointmentTypes = ['CONSULTATION', 'FOLLOW_UP', 'EMERGENCY', 'ROUTINE'];
  for (let i = 0; i < 20; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() + (i < 5 ? 0 : i - 5)); // first 5 today, rest future
    date.setHours(8 + (i % 8), (i % 2) * 30, 0, 0);
    await prisma.appointment.create({
      data: {
        patientId: patients[i % patients.length].id,
        doctorId: doctors[i % doctors.length].id,
        dateTime: date,
        duration: [15, 30, 45, 60][i % 4],
        type: appointmentTypes[i % appointmentTypes.length],
        status: i < 5 ? appointmentStatuses[i] : appointmentStatuses[Math.min(i % 3, 1)],
        notes: i % 3 === 0 ? 'Follow-up required' : null,
      },
    });
  }
  console.log('Created 20 appointments');

  // Admissions (8)
  const admissionPatients = patients.slice(0, 8);
  for (let i = 0; i < 8; i++) {
    const status = i < 3 ? 'ADMITTED' : i < 6 ? 'DISCHARGED' : 'TRANSFERRED';
    const admitDate = new Date(today);
    admitDate.setDate(admitDate.getDate() - (10 - i));
    await prisma.admission.create({
      data: {
        patientId: admissionPatients[i].id,
        doctorId: doctors[i % doctors.length].id,
        roomId: rooms[i].id,
        bedId: beds[i]?.id || null,
        admitDate,
        dischargeDate: status !== 'ADMITTED' ? new Date() : null,
        status,
        reason: ['Chest pain', 'Fracture', 'High fever', 'Surgery prep', 'Observation', 'Pneumonia', 'Post-op', 'Cardiac monitoring'][i],
      },
    });
  }
  console.log('Created 8 admissions');

  // Visits (15) with nested data
  for (let i = 0; i < 15; i++) {
    const visitDate = new Date(today);
    visitDate.setDate(visitDate.getDate() - i);
    const visit = await prisma.visit.create({
      data: {
        patientId: patients[i % patients.length].id,
        doctorId: doctors[i % doctors.length].id,
        visitDate,
        chiefComplaint: ['Headache', 'Back pain', 'Fever', 'Cough', 'Fatigue', 'Chest pain', 'Abdominal pain', 'Joint pain'][i % 8],
        vitalSigns: JSON.stringify({ bp: `${120 + (i % 20)}/${80 + (i % 10)}`, heartRate: 70 + (i % 20), temp: 98.6 + (i % 3) * 0.5, weight: 150 + i }),
        notes: i % 2 === 0 ? 'Patient appears stable' : null,
      },
    });

    // Diagnoses (1-2 per visit)
    await prisma.diagnosis.create({
      data: {
        visitId: visit.id,
        code: ['J06.9', 'M54.5', 'R50.9', 'R05', 'R53.83', 'R07.9', 'R10.9', 'M25.50'][i % 8],
        description: ['Upper respiratory infection', 'Low back pain', 'Fever unspecified', 'Cough', 'Fatigue', 'Chest pain', 'Abdominal pain', 'Joint pain'][i % 8],
        type: 'PRIMARY',
      },
    });
    if (i % 3 === 0) {
      await prisma.diagnosis.create({
        data: { visitId: visit.id, code: 'Z87.89', description: 'History of other conditions', type: 'SECONDARY' },
      });
    }

    // Lab Orders (for some visits)
    if (i < 10) {
      const labStatus = i < 3 ? 'COMPLETED' : i < 6 ? 'IN_PROGRESS' : 'ORDERED';
      const labOrder = await prisma.labOrder.create({
        data: {
          visitId: visit.id,
          testName: ['Complete Blood Count', 'Basic Metabolic Panel', 'Urinalysis', 'Chest X-Ray', 'Lipid Panel', 'Thyroid Panel', 'Liver Function', 'Blood Culture', 'MRI Brain', 'CT Abdomen'][i],
          category: ['BLOOD', 'BLOOD', 'URINE', 'IMAGING', 'BLOOD', 'BLOOD', 'BLOOD', 'BLOOD', 'IMAGING', 'IMAGING'][i],
          priority: i < 2 ? 'STAT' : i < 5 ? 'URGENT' : 'ROUTINE',
          status: labStatus,
          completedAt: labStatus === 'COMPLETED' ? new Date() : null,
        },
      });

      // Lab Results (for completed orders)
      if (labStatus === 'COMPLETED') {
        const results = [
          [
            { parameter: 'WBC', value: '7.5', unit: 'K/uL', normalRange: '4.5-11.0', isAbnormal: false },
            { parameter: 'RBC', value: '4.8', unit: 'M/uL', normalRange: '4.2-5.4', isAbnormal: false },
            { parameter: 'Hemoglobin', value: '14.2', unit: 'g/dL', normalRange: '12.0-16.0', isAbnormal: false },
            { parameter: 'Platelets', value: '250', unit: 'K/uL', normalRange: '150-400', isAbnormal: false },
          ],
          [
            { parameter: 'Glucose', value: '105', unit: 'mg/dL', normalRange: '70-100', isAbnormal: true },
            { parameter: 'BUN', value: '18', unit: 'mg/dL', normalRange: '7-20', isAbnormal: false },
            { parameter: 'Creatinine', value: '1.0', unit: 'mg/dL', normalRange: '0.6-1.2', isAbnormal: false },
            { parameter: 'Sodium', value: '140', unit: 'mEq/L', normalRange: '136-145', isAbnormal: false },
          ],
          [
            { parameter: 'Color', value: 'Yellow', unit: '', normalRange: 'Yellow', isAbnormal: false },
            { parameter: 'pH', value: '6.0', unit: '', normalRange: '5.0-8.0', isAbnormal: false },
            { parameter: 'Protein', value: 'Negative', unit: '', normalRange: 'Negative', isAbnormal: false },
          ],
        ];
        for (const result of results[i] || results[0]) {
          await prisma.labResult.create({ data: { labOrderId: labOrder.id, ...result } });
        }
      }
    }

    // Prescriptions (for some visits)
    if (i < 8) {
      const prescription = await prisma.prescription.create({
        data: {
          visitId: visit.id,
          doctorId: doctors[i % doctors.length].id,
          date: visitDate,
          status: i < 5 ? 'ACTIVE' : 'COMPLETED',
        },
      });

      // Prescription Items (1-3 per prescription)
      await prisma.prescriptionItem.create({
        data: {
          prescriptionId: prescription.id,
          medicationId: medications[i % medications.length].id,
          dosage: medications[i % medications.length].strength,
          frequency: ['once daily', 'twice daily', 'three times daily', 'every 8 hours'][i % 4],
          duration: ['7 days', '14 days', '30 days', '5 days'][i % 4],
          quantity: [21, 28, 30, 15][i % 4],
          instructions: i % 2 === 0 ? 'Take with food' : 'Take on empty stomach',
        },
      });
      if (i % 2 === 0) {
        const secondMed = (i + 1) % medications.length;
        await prisma.prescriptionItem.create({
          data: {
            prescriptionId: prescription.id,
            medicationId: medications[secondMed].id,
            dosage: medications[secondMed].strength,
            frequency: 'once daily',
            duration: '14 days',
            quantity: 14,
          },
        });
      }
    }
  }
  console.log('Created 15 visits with diagnoses, lab orders, and prescriptions');

  // Bills (10)
  for (let i = 0; i < 10; i++) {
    const billStatus = i < 3 ? 'PAID' : i < 6 ? 'PENDING' : i < 8 ? 'PARTIAL' : 'OVERDUE';
    const bill = await prisma.bill.create({
      data: {
        patientId: patients[i].id,
        date: new Date(today.getFullYear(), today.getMonth(), today.getDate() - i * 3),
        dueDate: new Date(today.getFullYear(), today.getMonth() + 1, today.getDate() - i * 3),
        totalAmount: 0,
        paidAmount: 0,
        status: billStatus,
      },
    });

    // Bill Line Items
    const items = [
      { description: 'Consultation Fee', category: 'CONSULTATION', quantity: 1, unitPrice: 250 },
      { description: 'Blood Test - CBC', category: 'LAB', quantity: 1, unitPrice: 45 },
    ];
    if (i % 2 === 0) items.push({ description: 'X-Ray', category: 'PROCEDURE', quantity: 1, unitPrice: 150 });
    if (i % 3 === 0) items.push({ description: 'Medication', category: 'MEDICATION', quantity: 2, unitPrice: 25 });

    let total = 0;
    for (const item of items) {
      const lineTotal = item.quantity * item.unitPrice;
      total += lineTotal;
      await prisma.billLineItem.create({
        data: { billId: bill.id, ...item, total: lineTotal },
      });
    }

    const paidAmount = billStatus === 'PAID' ? total : billStatus === 'PARTIAL' ? total * 0.5 : 0;
    await prisma.bill.update({
      where: { id: bill.id },
      data: { totalAmount: total, paidAmount },
    });
  }
  console.log('Created 10 bills with line items');

  console.log('Seeding complete!');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
