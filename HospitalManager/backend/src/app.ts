import express from 'express';
import cors from 'cors';
import { errorHandler } from './middleware/errorHandler';

// Simple CRUD
import departmentsRouter from './routes/departments';
import roomsRouter from './routes/rooms';
import medicationsRouter from './routes/medications';
import insurancePlansRouter from './routes/insurancePlans';
import suppliersRouter from './routes/suppliers';

// Rich Forms + Parent-Child
import patientsRouter from './routes/patients';
import doctorsRouter from './routes/doctors';
import bedsRouter from './routes/beds';
import staffRouter from './routes/staff';
import inventoryRouter from './routes/inventory';

// Many-to-Many
import patientInsuranceRouter from './routes/patientInsurance';
import doctorDepartmentsRouter from './routes/doctorDepartments';

// Status Workflow
import appointmentsRouter from './routes/appointments';
import admissionsRouter from './routes/admissions';

// Deep Nesting
import visitsRouter from './routes/visits';
import diagnosesRouter from './routes/diagnoses';
import labOrdersRouter from './routes/labOrders';
import labResultsRouter from './routes/labResults';

// 3-Level Deep
import prescriptionsRouter from './routes/prescriptions';
import prescriptionItemsRouter from './routes/prescriptionItems';

// Computed
import billsRouter from './routes/bills';
import billLineItemsRouter from './routes/billLineItems';

// Dashboard
import dashboardRouter from './routes/dashboard';

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/departments', departmentsRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/medications', medicationsRouter);
app.use('/api/insurance-plans', insurancePlansRouter);
app.use('/api/suppliers', suppliersRouter);

app.use('/api/patients', patientsRouter);
app.use('/api/doctors', doctorsRouter);
app.use('/api/beds', bedsRouter);
app.use('/api/staff', staffRouter);
app.use('/api/inventory', inventoryRouter);

app.use('/api/patient-insurance', patientInsuranceRouter);
app.use('/api/doctor-departments', doctorDepartmentsRouter);

app.use('/api/appointments', appointmentsRouter);
app.use('/api/admissions', admissionsRouter);

app.use('/api/visits', visitsRouter);
app.use('/api/diagnoses', diagnosesRouter);
app.use('/api/lab-orders', labOrdersRouter);
app.use('/api/lab-results', labResultsRouter);

app.use('/api/prescriptions', prescriptionsRouter);
app.use('/api/prescription-items', prescriptionItemsRouter);

app.use('/api/bills', billsRouter);
app.use('/api/bill-line-items', billLineItemsRouter);

app.use('/api/dashboard', dashboardRouter);

app.use(errorHandler);

export default app;
