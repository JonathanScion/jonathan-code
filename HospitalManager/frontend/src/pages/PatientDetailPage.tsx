import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import {
  Patient, PatientInsurance, InsurancePlan,
  Visit, Appointment, Bill,
} from '../types';

export default function PatientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const { useGet } = useCrud<Patient>({ endpoint: '/patients', queryKey: 'patients' });
  const { data: patient, isLoading, isError } = useGet(Number(id));

  // Insurance CRUD
  const {
    useList: useInsuranceList,
    useCreate: useCreateInsurance,
    useUpdate: useUpdateInsurance,
    useDelete: useDeleteInsurance,
  } = useCrud<PatientInsurance>({ endpoint: '/patient-insurance', queryKey: 'patient-insurance' });

  const { data: insuranceData } = useInsuranceList({ patientId: id });
  const createInsuranceMutation = useCreateInsurance();
  const updateInsuranceMutation = useUpdateInsurance();
  const deleteInsuranceMutation = useDeleteInsurance();

  // Fetch available insurance plans
  const { useList: usePlansList } = useCrud<InsurancePlan>({ endpoint: '/insurance-plans', queryKey: 'insurance-plans' });
  const { data: plansData } = usePlansList({ pageSize: 100 });

  // Insurance form state
  const [insuranceDialogOpen, setInsuranceDialogOpen] = useState(false);
  const [editingInsurance, setEditingInsurance] = useState<PatientInsurance | null>(null);
  const [insuranceForm, setInsuranceForm] = useState({
    insurancePlanId: '',
    policyNumber: '',
    startDate: '',
    endDate: '',
    isPrimary: false,
  });

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingInsurance, setDeletingInsurance] = useState<PatientInsurance | null>(null);

  const handleOpenInsurance = (ins?: PatientInsurance) => {
    if (ins) {
      setEditingInsurance(ins);
      setInsuranceForm({
        insurancePlanId: String(ins.insurancePlanId),
        policyNumber: ins.policyNumber,
        startDate: ins.startDate?.split('T')[0] || '',
        endDate: ins.endDate?.split('T')[0] || '',
        isPrimary: ins.isPrimary,
      });
    } else {
      setEditingInsurance(null);
      setInsuranceForm({
        insurancePlanId: '',
        policyNumber: '',
        startDate: '',
        endDate: '',
        isPrimary: false,
      });
    }
    setInsuranceDialogOpen(true);
  };

  const handleSubmitInsurance = async () => {
    try {
      const payload = {
        patientId: Number(id),
        insurancePlanId: Number(insuranceForm.insurancePlanId),
        policyNumber: insuranceForm.policyNumber,
        startDate: insuranceForm.startDate,
        endDate: insuranceForm.endDate || null,
        isPrimary: insuranceForm.isPrimary,
      };

      if (editingInsurance) {
        await updateInsuranceMutation.mutateAsync({ id: editingInsurance.id, data: payload });
        enqueueSnackbar('Insurance updated', { variant: 'success' });
      } else {
        await createInsuranceMutation.mutateAsync(payload as Partial<PatientInsurance>);
        enqueueSnackbar('Insurance added', { variant: 'success' });
      }
      setInsuranceDialogOpen(false);
      setEditingInsurance(null);
    } catch {
      enqueueSnackbar('Failed to save insurance', { variant: 'error' });
    }
  };

  const handleDeleteInsurance = async () => {
    if (!deletingInsurance) return;
    try {
      await deleteInsuranceMutation.mutateAsync(deletingInsurance.id);
      enqueueSnackbar('Insurance removed', { variant: 'success' });
      setDeleteDialogOpen(false);
      setDeletingInsurance(null);
    } catch {
      enqueueSnackbar('Failed to remove insurance', { variant: 'error' });
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

  const overviewTab = patient ? (
    <Card variant="outlined" sx={{ p: 3 }}>
      <Grid2 container spacing={2}>
        <Grid2 size={{ xs: 12 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>Personal</Typography>
        </Grid2>
        <InfoRow label="Full Name" value={`${patient.firstName} ${patient.lastName}`} />
        <InfoRow label="Date of Birth" value={patient.dateOfBirth?.split('T')[0]} />
        <InfoRow label="Gender" value={patient.gender} />
        <InfoRow label="SSN" value={patient.ssn} />

        <Grid2 size={{ xs: 12 }} sx={{ mt: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>Contact</Typography>
        </Grid2>
        <InfoRow label="Email" value={patient.email} />
        <InfoRow label="Phone" value={patient.phone} />
        <InfoRow label="Address" value={
          [patient.address, patient.city, patient.state, patient.zipCode]
            .filter(Boolean).join(', ') || '-'
        } />

        <Grid2 size={{ xs: 12 }} sx={{ mt: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>Emergency Contact</Typography>
        </Grid2>
        <InfoRow label="Name" value={patient.emergencyName} />
        <InfoRow label="Phone" value={patient.emergencyPhone} />
        <InfoRow label="Relation" value={patient.emergencyRelation} />

        <Grid2 size={{ xs: 12 }} sx={{ mt: 2 }}>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>Medical</Typography>
        </Grid2>
        <InfoRow label="Blood Type" value={patient.bloodType} />
        <InfoRow label="Allergies" value={patient.allergies} />
        <InfoRow label="Medical Notes" value={patient.medicalNotes} />
      </Grid2>
    </Card>
  ) : null;

  const visitsTab = (
    <NestedTable
      columns={[
        { key: 'visitDate', label: 'Date', render: (row: Visit) => row.visitDate?.split('T')[0] },
        { key: 'doctor', label: 'Doctor', render: (row: Visit) =>
          row.doctor ? `${row.doctor.firstName} ${row.doctor.lastName}` : '-'
        },
        { key: 'chiefComplaint', label: 'Chief Complaint' },
      ]}
      rows={patient?.visits || []}
      onRowClick={(row) => navigate(`/visits/${row.id}`)}
      emptyMessage="No visits recorded."
    />
  );

  const appointmentsTab = (
    <NestedTable
      columns={[
        { key: 'dateTime', label: 'Date/Time', render: (row: Appointment) =>
          new Date(row.dateTime).toLocaleString()
        },
        { key: 'doctor', label: 'Doctor', render: (row: Appointment) =>
          row.doctor ? `${row.doctor.firstName} ${row.doctor.lastName}` : '-'
        },
        { key: 'type', label: 'Type' },
        { key: 'status', label: 'Status', render: (row: Appointment) =>
          <StatusChip status={row.status} />
        },
      ]}
      rows={patient?.appointments || []}
      emptyMessage="No appointments scheduled."
    />
  );

  const insuranceRows = insuranceData?.data || [];
  const insuranceTab = (
    <>
      <NestedTable
        columns={[
          { key: 'planName', label: 'Plan Name', render: (row: PatientInsurance) =>
            row.insurancePlan?.name || '-'
          },
          { key: 'policyNumber', label: 'Policy Number' },
          { key: 'isPrimary', label: 'Primary', render: (row: PatientInsurance) =>
            row.isPrimary ? <Chip label="Primary" color="primary" size="small" /> : 'No'
          },
        ]}
        rows={insuranceRows}
        onAdd={() => handleOpenInsurance()}
        addLabel="Add Insurance"
        onEdit={(row) => handleOpenInsurance(row)}
        onDelete={(row) => { setDeletingInsurance(row); setDeleteDialogOpen(true); }}
        emptyMessage="No insurance records."
      />

      <FormDialog
        open={insuranceDialogOpen}
        onClose={() => { setInsuranceDialogOpen(false); setEditingInsurance(null); }}
        onSubmit={handleSubmitInsurance}
        title={editingInsurance ? 'Edit Insurance' : 'Add Insurance'}
        loading={createInsuranceMutation.isPending || updateInsuranceMutation.isPending}
      >
        <TextField
          fullWidth select label="Insurance Plan" required
          value={insuranceForm.insurancePlanId}
          onChange={(e) => setInsuranceForm((prev) => ({ ...prev, insurancePlanId: e.target.value }))}
        >
          {(plansData?.data || []).map((plan) => (
            <MenuItem key={plan.id} value={String(plan.id)}>
              {plan.name} ({plan.provider})
            </MenuItem>
          ))}
        </TextField>
        <TextField
          fullWidth label="Policy Number" required
          value={insuranceForm.policyNumber}
          onChange={(e) => setInsuranceForm((prev) => ({ ...prev, policyNumber: e.target.value }))}
        />
        <TextField
          fullWidth label="Start Date" type="date" required
          value={insuranceForm.startDate}
          onChange={(e) => setInsuranceForm((prev) => ({ ...prev, startDate: e.target.value }))}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <TextField
          fullWidth label="End Date" type="date"
          value={insuranceForm.endDate}
          onChange={(e) => setInsuranceForm((prev) => ({ ...prev, endDate: e.target.value }))}
          slotProps={{ inputLabel: { shrink: true } }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={insuranceForm.isPrimary}
              onChange={(e) => setInsuranceForm((prev) => ({ ...prev, isPrimary: e.target.checked }))}
            />
          }
          label="Primary Insurance"
        />
      </FormDialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setDeletingInsurance(null); }}
        onConfirm={handleDeleteInsurance}
        loading={deleteInsuranceMutation.isPending}
        message="Are you sure you want to remove this insurance record?"
      />
    </>
  );

  const billsTab = (
    <NestedTable
      columns={[
        { key: 'date', label: 'Date', render: (row: Bill) => row.date?.split('T')[0] },
        { key: 'totalAmount', label: 'Total', render: (row: Bill) => `$${row.totalAmount.toFixed(2)}` },
        { key: 'status', label: 'Status', render: (row: Bill) => <StatusChip status={row.status} /> },
      ]}
      rows={patient?.bills || []}
      onRowClick={(row) => navigate(`/bills/${row.id}`)}
      emptyMessage="No bills found."
    />
  );

  return (
    <DetailPageLayout
      loading={isLoading}
      error={isError}
      header={
        <PageHeader
          title={patient ? `${patient.firstName} ${patient.lastName}` : 'Patient'}
          breadcrumbs={[
            { label: 'Patients', to: '/patients' },
            { label: patient ? `${patient.firstName} ${patient.lastName}` : '...' },
          ]}
        />
      }
      tabs={[
        { label: 'Overview', content: overviewTab },
        { label: 'Visits', content: visitsTab },
        { label: 'Appointments', content: appointmentsTab },
        { label: 'Insurance', content: insuranceTab },
        { label: 'Bills', content: billsTab },
      ]}
    />
  );
}
