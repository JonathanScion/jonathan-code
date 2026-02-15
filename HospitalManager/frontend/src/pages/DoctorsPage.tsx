import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, TextField, Typography } from '@mui/material';
import Grid2 from '@mui/material/Grid2';
import { GridColDef, GridPaginationModel } from '@mui/x-data-grid';
import { useSnackbar } from 'notistack';
import { useCrud } from '../hooks/useCrud';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import FormDialog from '../components/FormDialog';
import { Doctor } from '../types';

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  licenseNumber: '',
  specialization: '',
  yearsExperience: '',
  consultationFee: '',
};

export default function DoctorsPage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { useList, useCreate, useUpdate } = useCrud<Doctor>({ endpoint: '/doctors', queryKey: 'doctors' });

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 10 });
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDoctor, setEditingDoctor] = useState<Doctor | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useList({
    page: paginationModel.page + 1,
    pageSize: paginationModel.pageSize,
    search: search || undefined,
  });

  const createMutation = useCreate();
  const updateMutation = useUpdate();

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      valueGetter: (_value, row) => `Dr. ${row.firstName} ${row.lastName}`,
    },
    { field: 'email', headerName: 'Email', flex: 1 },
    { field: 'specialization', headerName: 'Specialization', width: 160 },
    { field: 'licenseNumber', headerName: 'License #', width: 130 },
    {
      field: 'consultationFee',
      headerName: 'Fee',
      width: 100,
      valueFormatter: (value: number) => `$${value?.toFixed(2) ?? '0.00'}`,
    },
    {
      field: 'appointments',
      headerName: 'Appointments',
      width: 120,
      valueGetter: (_value, row) => row._count?.appointments ?? 0,
    },
  ];

  const handleOpen = (doctor?: Doctor) => {
    if (doctor) {
      setEditingDoctor(doctor);
      setForm({
        firstName: doctor.firstName,
        lastName: doctor.lastName,
        email: doctor.email,
        phone: doctor.phone || '',
        licenseNumber: doctor.licenseNumber,
        specialization: doctor.specialization,
        yearsExperience: String(doctor.yearsExperience),
        consultationFee: String(doctor.consultationFee),
      });
    } else {
      setEditingDoctor(null);
      setForm(emptyForm);
    }
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditingDoctor(null);
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || null,
        licenseNumber: form.licenseNumber,
        specialization: form.specialization,
        yearsExperience: Number(form.yearsExperience),
        consultationFee: Number(form.consultationFee),
      };

      if (editingDoctor) {
        await updateMutation.mutateAsync({ id: editingDoctor.id, data: payload });
        enqueueSnackbar('Doctor updated', { variant: 'success' });
      } else {
        await createMutation.mutateAsync(payload as Partial<Doctor>);
        enqueueSnackbar('Doctor created', { variant: 'success' });
      }
      handleClose();
    } catch {
      enqueueSnackbar('Failed to save doctor', { variant: 'error' });
    }
  };

  const updateField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <Box>
      <PageHeader title="Doctors" onAdd={() => handleOpen()} addLabel="Add Doctor" />

      <DataTable
        columns={columns}
        rows={data?.data || []}
        total={data?.pagination.total || 0}
        loading={isLoading}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        onSearch={setSearch}
        searchPlaceholder="Search by name..."
        onRowClick={(row) => navigate(`/doctors/${row.id}`)}
      />

      <FormDialog
        open={dialogOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        title={editingDoctor ? 'Edit Doctor' : 'Add Doctor'}
        loading={createMutation.isPending || updateMutation.isPending}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Personal Information
          </Typography>
          <Grid2 container spacing={2}>
            <Grid2 size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="First Name" required value={form.firstName}
                onChange={(e) => updateField('firstName', e.target.value)} />
            </Grid2>
            <Grid2 size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Last Name" required value={form.lastName}
                onChange={(e) => updateField('lastName', e.target.value)} />
            </Grid2>
            <Grid2 size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Email" type="email" required value={form.email}
                onChange={(e) => updateField('email', e.target.value)} />
            </Grid2>
            <Grid2 size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Phone" value={form.phone}
                onChange={(e) => updateField('phone', e.target.value)} />
            </Grid2>
          </Grid2>
        </Box>

        <Box>
          <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2 }}>
            Professional Information
          </Typography>
          <Grid2 container spacing={2}>
            <Grid2 size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="License Number" required value={form.licenseNumber}
                onChange={(e) => updateField('licenseNumber', e.target.value)} />
            </Grid2>
            <Grid2 size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Specialization" required value={form.specialization}
                onChange={(e) => updateField('specialization', e.target.value)} />
            </Grid2>
            <Grid2 size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Years of Experience" type="number" value={form.yearsExperience}
                onChange={(e) => updateField('yearsExperience', e.target.value)} />
            </Grid2>
            <Grid2 size={{ xs: 12, sm: 6 }}>
              <TextField fullWidth label="Consultation Fee ($)" type="number" value={form.consultationFee}
                onChange={(e) => updateField('consultationFee', e.target.value)} />
            </Grid2>
          </Grid2>
        </Box>
      </FormDialog>
    </Box>
  );
}
