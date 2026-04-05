import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card, Box, Typography, TextField, MenuItem,
  FormControlLabel, Switch, Chip,
} from '@mui/material';
import Grid2 from '@mui/material/Grid2';
import { useSnackbar } from 'notistack';
import { useCrud } from '../hooks/useCrud';
import PageHeader from '../components/PageHeader';
import DetailPageLayout from '../components/DetailPageLayout';
import NestedTable from '../components/NestedTable';
import FormDialog from '../components/FormDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusChip from '../components/StatusChip';
import { Doctor, DoctorDepartment, Department, Appointment } from '../types';

export default function DoctorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { enqueueSnackbar } = useSnackbar();

  const { useGet } = useCrud<Doctor>({ endpoint: '/doctors', queryKey: 'doctors' });
  const { data: doctor, isLoading, isError } = useGet(Number(id));

  // Doctor-Department CRUD
  const {
    useList: useDeptLinkList,
    useCreate: useCreateDeptLink,
    useDelete: useDeleteDeptLink,
  } = useCrud<DoctorDepartment>({ endpoint: '/doctor-departments', queryKey: 'doctor-departments' });

  const { data: deptLinksData } = useDeptLinkList({ doctorId: id });
  const createDeptLinkMutation = useCreateDeptLink();
  const deleteDeptLinkMutation = useDeleteDeptLink();

  // Fetch departments for dropdown
  const { useList: useDeptList } = useCrud<Department>({ endpoint: '/departments', queryKey: 'departments' });
  const { data: deptsData } = useDeptList({ pageSize: 100 });

  // Department link form state
  const [deptDialogOpen, setDeptDialogOpen] = useState(false);
  const [deptForm, setDeptForm] = useState({
    departmentId: '',
    isPrimary: false,
    startDate: new Date().toISOString().split('T')[0],
  });

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingLink, setDeletingLink] = useState<DoctorDepartment | null>(null);

  const handleOpenDeptDialog = () => {
    setDeptForm({
      departmentId: '',
      isPrimary: false,
      startDate: new Date().toISOString().split('T')[0],
    });
    setDeptDialogOpen(true);
  };

  const handleSubmitDeptLink = async () => {
    try {
      await createDeptLinkMutation.mutateAsync({
        doctorId: Number(id),
        departmentId: Number(deptForm.departmentId),
        isPrimary: deptForm.isPrimary,
        startDate: deptForm.startDate,
      } as Partial<DoctorDepartment>);
      enqueueSnackbar('Department added', { variant: 'success' });
      setDeptDialogOpen(false);
    } catch {
      enqueueSnackbar('Failed to add department', { variant: 'error' });
    }
  };

  const handleDeleteDeptLink = async () => {
    if (!deletingLink) return;
    try {
      await deleteDeptLinkMutation.mutateAsync(deletingLink.id);
      enqueueSnackbar('Department removed', { variant: 'success' });
      setDeleteDialogOpen(false);
      setDeletingLink(null);
    } catch {
      enqueueSnackbar('Failed to remove department', { variant: 'error' });
    }
  };

  const InfoRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <>
      <Grid2 size={{ xs: 12, sm: 4 }}>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
      </Grid2>
      <Grid2 size={{ xs: 12, sm: 8 }}>
        <Typography variant="body2">{value || '-'}</Typography>
      </Grid2>
    </>
  );

  const overviewTab = doctor ? (
    <Card variant="outlined" sx={{ p: 3 }}>
      <Grid2 container spacing={2}>
        <Grid2 size={{ xs: 12 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>Personal</Typography>
        </Grid2>
        <InfoRow label="Full Name" value={`Dr. ${doctor.firstName} ${doctor.lastName}`} />
        <InfoRow label="Email" value={doctor.email} />
        <InfoRow label="Phone" value={doctor.phone} />

        <Grid2 size={{ xs: 12 }} sx={{ mt: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>Professional</Typography>
        </Grid2>
        <InfoRow label="License Number" value={doctor.licenseNumber} />
        <InfoRow label="Specialization" value={doctor.specialization} />
        <InfoRow label="Years of Experience" value={doctor.yearsExperience} />
        <InfoRow label="Consultation Fee" value={`$${Number(doctor.consultationFee)?.toFixed(2)}`} />
      </Grid2>
    </Card>
  ) : null;

  const deptLinkRows = deptLinksData?.data || [];
  const departmentsTab = (
    <>
      <NestedTable
        columns={[
          { key: 'departmentName', label: 'Department', render: (row: DoctorDepartment) =>
            row.department?.name || '-'
          },
          { key: 'isPrimary', label: 'Primary', render: (row: DoctorDepartment) =>
            row.isPrimary ? <Chip label="Primary" color="primary" size="small" /> : 'No'
          },
          { key: 'startDate', label: 'Start Date', render: (row: DoctorDepartment) =>
            row.startDate?.split('T')[0]
          },
        ]}
        rows={deptLinkRows}
        onAdd={handleOpenDeptDialog}
        addLabel="Add Department"
        onDelete={(row) => { setDeletingLink(row); setDeleteDialogOpen(true); }}
        emptyMessage="Not assigned to any departments."
      />

      <FormDialog
        open={deptDialogOpen}
        onClose={() => setDeptDialogOpen(false)}
        onSubmit={handleSubmitDeptLink}
        title="Add Department"
        loading={createDeptLinkMutation.isPending}
      >
        <TextField
          fullWidth select label="Department" required
          value={deptForm.departmentId}
          onChange={(e) => setDeptForm((prev) => ({ ...prev, departmentId: e.target.value }))}
        >
          {(deptsData?.data || []).map((dept) => (
            <MenuItem key={dept.id} value={String(dept.id)}>{dept.name}</MenuItem>
          ))}
        </TextField>
        <TextField
          fullWidth label="Start Date" type="date" required
          value={deptForm.startDate}
          onChange={(e) => setDeptForm((prev) => ({ ...prev, startDate: e.target.value }))}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={deptForm.isPrimary}
              onChange={(e) => setDeptForm((prev) => ({ ...prev, isPrimary: e.target.checked }))}
            />
          }
          label="Primary Department"
        />
      </FormDialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setDeletingLink(null); }}
        onConfirm={handleDeleteDeptLink}
        loading={deleteDeptLinkMutation.isPending}
        message="Are you sure you want to remove this department assignment?"
      />
    </>
  );

  const appointmentsTab = (
    <NestedTable
      columns={[
        { key: 'dateTime', label: 'Date/Time', render: (row: Appointment) =>
          new Date(row.dateTime).toLocaleString()
        },
        { key: 'patient', label: 'Patient', render: (row: Appointment) =>
          row.patient ? `${row.patient.firstName} ${row.patient.lastName}` : '-'
        },
        { key: 'type', label: 'Type' },
        { key: 'status', label: 'Status', render: (row: Appointment) =>
          <StatusChip status={row.status} />
        },
      ]}
      rows={doctor?.departments ? [] : []}
      emptyMessage="No appointments found."
    />
  );

  return (
    <DetailPageLayout
      loading={isLoading}
      error={isError}
      header={
        <PageHeader
          title={doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : 'Doctor'}
          breadcrumbs={[
            { label: 'Doctors', to: '/doctors' },
            { label: doctor ? `Dr. ${doctor.firstName} ${doctor.lastName}` : '...' },
          ]}
        />
      }
      tabs={[
        { label: 'Overview', content: overviewTab },
        { label: 'Departments', content: departmentsTab },
        { label: 'Appointments', content: appointmentsTab },
      ]}
    />
  );
}
