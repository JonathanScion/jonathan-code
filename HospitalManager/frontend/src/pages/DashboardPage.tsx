import { useQuery } from '@tanstack/react-query';
import {
  Card, CardContent, Typography, Box, CircularProgress,
} from '@mui/material';
import Grid2 from '@mui/material/Grid2';
import {
  People as PeopleIcon,
  EventNote as AppointmentIcon,
  Hotel as BedIcon,
  Science as LabIcon,
  Receipt as BillIcon,
} from '@mui/icons-material';
import api from '../utils/api';
import { DashboardStats } from '../types';
import PageHeader from '../components/PageHeader';

function StatCard({ title, value, subtitle, icon, color }: {
  title: string; value: string | number; subtitle?: string;
  icon: React.ReactNode; color: string;
}) {
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography color="text.secondary" variant="body2" gutterBottom>{title}</Typography>
            <Typography variant="h4" fontWeight={700}>{value}</Typography>
            {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>{subtitle}</Typography>}
          </Box>
          <Box sx={{ bgcolor: `${color}15`, borderRadius: 2, p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Box sx={{ color }}>{icon}</Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: () => api.get('/dashboard').then(r => r.data),
  });

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader title="Dashboard" />
      <Grid2 container spacing={3}>
        <Grid2 size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard
            title="Total Patients"
            value={stats?.patientCount ?? 0}
            icon={<PeopleIcon fontSize="large" />}
            color="#1565C0"
          />
        </Grid2>
        <Grid2 size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard
            title="Today's Appointments"
            value={stats?.todayAppointments ?? 0}
            icon={<AppointmentIcon fontSize="large" />}
            color="#00897B"
          />
        </Grid2>
        <Grid2 size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard
            title="Bed Occupancy"
            value={`${stats?.bedOccupancy.occupied ?? 0}/${stats?.bedOccupancy.total ?? 0}`}
            subtitle={stats?.bedOccupancy.total ? `${Math.round((stats.bedOccupancy.occupied / stats.bedOccupancy.total) * 100)}% occupied` : ''}
            icon={<BedIcon fontSize="large" />}
            color="#F57C00"
          />
        </Grid2>
        <Grid2 size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard
            title="Pending Lab Orders"
            value={stats?.pendingLabOrders ?? 0}
            icon={<LabIcon fontSize="large" />}
            color="#7B1FA2"
          />
        </Grid2>
        <Grid2 size={{ xs: 12, sm: 6, md: 4, lg: 2.4 }}>
          <StatCard
            title="Outstanding Bills"
            value={stats?.outstandingBills.count ?? 0}
            subtitle={`$${Number(stats?.outstandingBills.total ?? 0).toFixed(2)} total`}
            icon={<BillIcon fontSize="large" />}
            color="#D32F2F"
          />
        </Grid2>
      </Grid2>
    </Box>
  );
}
