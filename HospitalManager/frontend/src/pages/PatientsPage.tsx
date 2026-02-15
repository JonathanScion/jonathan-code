import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, TextField, MenuItem, Accordion, AccordionSummary,
  AccordionDetails, Typography,
} from '@mui/material';
import Grid2 from '@mui/material/Grid2';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { GridColDef, GridPaginationModel } from '@mui/x-data-grid';
import { useSnackbar } from 'notistack';
import { useCrud } from '../hooks/useCrud';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import FormDialog from '../components/FormDialog';
import { Patient } from '../types';

const GENDERS = ['MALE', 'FEMALE', 'OTHER'];
const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const emptyForm = {
  firstName: '',
  lastName: '',
  dateOfBirth: '',
  gender: '',
  ssn: '',
  email: '',
  phone: '',
  address: '',
  city: '',
  state: '',
  zipCode: '',
  emergencyName: '',
  emergencyPhone: '',
  emergencyRelation: '',
  bloodType: '',
  allergies: '',
  medicalNotes: '',
};

export default function PatientsPage() {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { useList, useCreate, useUpdate } = useCrud<Patient>({ endpoint: '/patients', queryKey: 'patients' });

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 10 });
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
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
      valueGetter: (_value, row) => `${row.firstName} ${row.lastName}`,
    },
    { field: 'dateOfBirth', headerName: 'Date of Birth', width: 130 },
    { field: 'gender', headerName: 'Gender', width: 100 },
    { field: 'phone', headerName: 'Phone', width: 140 },
    { field: 'email', headerName: 'Email', flex: 1 },
    {
      field: 'visits',
      headerName: 'Visits',
      width: 80,
      valueGetter: (_value, row) => row._count?.visits ?? 0,
    },
  ];

  const handleOpen = (patient?: Patient) => {
    if (patient) {
      setEditingPatient(patient);
      setForm({
        firstName: patient.firstName,
        lastName: patient.lastName,
        dateOfBirth: patient.dateOfBirth?.split('T')[0] || '',
        gender: patient.gender,
        ssn: patient.ssn || '',
        email: patient.email || '',
        phone: patient.phone || '',
        address: patient.address || '',
        city: patient.city || '',
        state: patient.state || '',
        zipCode: patient.zipCode || '',
        emergencyName: patient.emergencyName || '',
        emergencyPhone: patient.emergencyPhone || '',
        emergencyRelation: patient.emergencyRelation || '',
        bloodType: patient.bloodType || '',
        allergies: patient.allergies || '',
        medicalNotes: patient.medicalNotes || '',
      });
    } else {
      setEditingPatient(null);
      setForm(emptyForm);
    }
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditingPatient(null);
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        ...form,
        ssn: form.ssn || null,
        email: form.email || null,
        phone: form.phone || null,
        address: form.address || null,
        city: form.city || null,
        state: form.state || null,
        zipCode: form.zipCode || null,
        emergencyName: form.emergencyName || null,
        emergencyPhone: form.emergencyPhone || null,
        emergencyRelation: form.emergencyRelation || null,
        bloodType: form.bloodType || null,
        allergies: form.allergies || null,
        medicalNotes: form.medicalNotes || null,
      };

      if (editingPatient) {
        await updateMutation.mutateAsync({ id: editingPatient.id, data: payload });
        enqueueSnackbar('Patient updated', { variant: 'success' });
      } else {
        await createMutation.mutateAsync(payload as Partial<Patient>);
        enqueueSnackbar('Patient created', { variant: 'success' });
      }
      handleClose();
    } catch {
      enqueueSnackbar('Failed to save patient', { variant: 'error' });
    }
  };

  const updateField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <Box>
      <PageHeader title="Patients" onAdd={() => handleOpen()} addLabel="Add Patient" />

      <DataTable
        columns={columns}
        rows={data?.data || []}
        total={data?.pagination.total || 0}
        loading={isLoading}
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        onSearch={setSearch}
        searchPlaceholder="Search by name..."
        onRowClick={(row) => navigate(`/patients/${row.id}`)}
      />

      <FormDialog
        open={dialogOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        title={editingPatient ? 'Edit Patient' : 'Add Patient'}
        loading={createMutation.isPending || updateMutation.isPending}
        maxWidth="md"
      >
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>Personal Information</Typography>
          </AccordionSummary>
          <AccordionDetails>
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
                <TextField fullWidth label="Date of Birth" type="date" required
                  value={form.dateOfBirth}
                  onChange={(e) => updateField('dateOfBirth', e.target.value)}
                  slotProps={{ inputLabel: { shrink: true } }} />
              </Grid2>
              <Grid2 size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth select label="Gender" required value={form.gender}
                  onChange={(e) => updateField('gender', e.target.value)}>
                  {GENDERS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                </TextField>
              </Grid2>
              <Grid2 size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="SSN" value={form.ssn}
                  onChange={(e) => updateField('ssn', e.target.value)} />
              </Grid2>
            </Grid2>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>Contact Information</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid2 container spacing={2}>
              <Grid2 size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Email" type="email" value={form.email}
                  onChange={(e) => updateField('email', e.target.value)} />
              </Grid2>
              <Grid2 size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Phone" value={form.phone}
                  onChange={(e) => updateField('phone', e.target.value)} />
              </Grid2>
              <Grid2 size={{ xs: 12 }}>
                <TextField fullWidth label="Address" value={form.address}
                  onChange={(e) => updateField('address', e.target.value)} />
              </Grid2>
              <Grid2 size={{ xs: 12, sm: 4 }}>
                <TextField fullWidth label="City" value={form.city}
                  onChange={(e) => updateField('city', e.target.value)} />
              </Grid2>
              <Grid2 size={{ xs: 12, sm: 4 }}>
                <TextField fullWidth label="State" value={form.state}
                  onChange={(e) => updateField('state', e.target.value)} />
              </Grid2>
              <Grid2 size={{ xs: 12, sm: 4 }}>
                <TextField fullWidth label="Zip Code" value={form.zipCode}
                  onChange={(e) => updateField('zipCode', e.target.value)} />
              </Grid2>
            </Grid2>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>Emergency Contact</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid2 container spacing={2}>
              <Grid2 size={{ xs: 12, sm: 4 }}>
                <TextField fullWidth label="Contact Name" value={form.emergencyName}
                  onChange={(e) => updateField('emergencyName', e.target.value)} />
              </Grid2>
              <Grid2 size={{ xs: 12, sm: 4 }}>
                <TextField fullWidth label="Contact Phone" value={form.emergencyPhone}
                  onChange={(e) => updateField('emergencyPhone', e.target.value)} />
              </Grid2>
              <Grid2 size={{ xs: 12, sm: 4 }}>
                <TextField fullWidth label="Relation" value={form.emergencyRelation}
                  onChange={(e) => updateField('emergencyRelation', e.target.value)} />
              </Grid2>
            </Grid2>
          </AccordionDetails>
        </Accordion>

        <Accordion>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography fontWeight={600}>Medical Information</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid2 container spacing={2}>
              <Grid2 size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth select label="Blood Type" value={form.bloodType}
                  onChange={(e) => updateField('bloodType', e.target.value)}>
                  <MenuItem value="">None</MenuItem>
                  {BLOOD_TYPES.map((bt) => <MenuItem key={bt} value={bt}>{bt}</MenuItem>)}
                </TextField>
              </Grid2>
              <Grid2 size={{ xs: 12 }}>
                <TextField fullWidth label="Allergies" multiline rows={3}
                  value={form.allergies}
                  onChange={(e) => updateField('allergies', e.target.value)} />
              </Grid2>
              <Grid2 size={{ xs: 12 }}>
                <TextField fullWidth label="Medical Notes" multiline rows={3}
                  value={form.medicalNotes}
                  onChange={(e) => updateField('medicalNotes', e.target.value)} />
              </Grid2>
            </Grid2>
          </AccordionDetails>
        </Accordion>
      </FormDialog>
    </Box>
  );
}
