import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import theme from './theme';
import Layout from './components/Layout';

// Pages
import DashboardPage from './pages/DashboardPage';
import DepartmentsPage from './pages/DepartmentsPage';
import RoomsPage from './pages/RoomsPage';
import RoomDetailPage from './pages/RoomDetailPage';
import MedicationsPage from './pages/MedicationsPage';
import InsurancePlansPage from './pages/InsurancePlansPage';
import SuppliersPage from './pages/SuppliersPage';
import SupplierDetailPage from './pages/SupplierDetailPage';
import PatientsPage from './pages/PatientsPage';
import PatientDetailPage from './pages/PatientDetailPage';
import DoctorsPage from './pages/DoctorsPage';
import DoctorDetailPage from './pages/DoctorDetailPage';
import StaffPage from './pages/StaffPage';
import AppointmentsPage from './pages/AppointmentsPage';
import AdmissionsPage from './pages/AdmissionsPage';
import VisitsPage from './pages/VisitsPage';
import VisitDetailPage from './pages/VisitDetailPage';
import LabOrdersPage from './pages/LabOrdersPage';
import LabOrderDetailPage from './pages/LabOrderDetailPage';
import PrescriptionDetailPage from './pages/PrescriptionDetailPage';
import BillsPage from './pages/BillsPage';
import BillDetailPage from './pages/BillDetailPage';
import InventoryPage from './pages/InventoryPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider maxSnack={3} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
          <BrowserRouter>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<DashboardPage />} />
                {/* Simple CRUD */}
                <Route path="/departments" element={<DepartmentsPage />} />
                <Route path="/rooms" element={<RoomsPage />} />
                <Route path="/rooms/:id" element={<RoomDetailPage />} />
                <Route path="/medications" element={<MedicationsPage />} />
                <Route path="/insurance-plans" element={<InsurancePlansPage />} />
                <Route path="/suppliers" element={<SuppliersPage />} />
                <Route path="/suppliers/:id" element={<SupplierDetailPage />} />
                {/* Rich Forms */}
                <Route path="/patients" element={<PatientsPage />} />
                <Route path="/patients/:id" element={<PatientDetailPage />} />
                <Route path="/doctors" element={<DoctorsPage />} />
                <Route path="/doctors/:id" element={<DoctorDetailPage />} />
                <Route path="/staff" element={<StaffPage />} />
                {/* Workflow */}
                <Route path="/appointments" element={<AppointmentsPage />} />
                <Route path="/admissions" element={<AdmissionsPage />} />
                {/* Deep Nesting */}
                <Route path="/visits" element={<VisitsPage />} />
                <Route path="/visits/:id" element={<VisitDetailPage />} />
                <Route path="/lab-orders" element={<LabOrdersPage />} />
                <Route path="/lab-orders/:id" element={<LabOrderDetailPage />} />
                <Route path="/prescriptions/:id" element={<PrescriptionDetailPage />} />
                {/* Billing */}
                <Route path="/bills" element={<BillsPage />} />
                <Route path="/bills/:id" element={<BillDetailPage />} />
                <Route path="/inventory" element={<InventoryPage />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </SnackbarProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
