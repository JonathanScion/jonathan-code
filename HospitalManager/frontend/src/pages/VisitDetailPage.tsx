import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, Box, Typography, TextField, MenuItem, IconButton } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useCrud } from '../hooks/useCrud';
import PageHeader from '../components/PageHeader';
import DetailPageLayout from '../components/DetailPageLayout';
import NestedTable from '../components/NestedTable';
import FormDialog from '../components/FormDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusChip from '../components/StatusChip';
import { Visit, Diagnosis, LabOrder, Prescription, Doctor } from '../types';

const diagnosisTypes = ['PRIMARY', 'SECONDARY', 'DIFFERENTIAL'] as const;
const labCategories = ['BLOOD', 'URINE', 'IMAGING', 'BIOPSY', 'OTHER'] as const;
const labPriorities = ['STAT', 'URGENT', 'ROUTINE'] as const;

const emptyDiagnosis = { code: '', description: '', type: 'PRIMARY' as string, notes: '' };
const emptyLabOrder = { testName: '', category: 'BLOOD' as string, priority: 'ROUTINE' as string, notes: '' };
const emptyPrescription = { doctorId: '' as number | '', date: '', notes: '' };

export default function VisitDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  // Diagnosis state
  const [diagDialogOpen, setDiagDialogOpen] = useState(false);
  const [editDiag, setEditDiag] = useState<Diagnosis | null>(null);
  const [deleteDiag, setDeleteDiag] = useState<Diagnosis | null>(null);
  const [diagForm, setDiagForm] = useState(emptyDiagnosis);

  // Lab order state
  const [labDialogOpen, setLabDialogOpen] = useState(false);
  const [editLab, setEditLab] = useState<LabOrder | null>(null);
  const [deleteLab, setDeleteLab] = useState<LabOrder | null>(null);
  const [labForm, setLabForm] = useState(emptyLabOrder);

  // Prescription state
  const [rxDialogOpen, setRxDialogOpen] = useState(false);
  const [editRx, setEditRx] = useState<Prescription | null>(null);
  const [deleteRx, setDeleteRx] = useState<Prescription | null>(null);
  const [rxForm, setRxForm] = useState(emptyPrescription);

  // Fetch visit detail
  const { useGet } = useCrud<Visit>({ endpoint: '/visits', queryKey: 'visits' });
  const { data: visit, isLoading, isError } = useGet(Number(id));

  // Diagnosis CRUD
  const diagCrud = useCrud<Diagnosis>({ endpoint: '/diagnoses', queryKey: 'diagnoses' });
  const diagCreate = diagCrud.useCreate();
  const diagUpdate = diagCrud.useUpdate();
  const diagDelete = diagCrud.useDelete();

  // Lab order CRUD
  const labCrud = useCrud<LabOrder>({ endpoint: '/lab-orders', queryKey: 'lab-orders' });
  const labCreate = labCrud.useCreate();
  const labUpdate = labCrud.useUpdate();
  const labDelete = labCrud.useDelete();

  // Prescription CRUD
  const rxCrud = useCrud<Prescription>({ endpoint: '/prescriptions', queryKey: 'prescriptions' });
  const rxCreate = rxCrud.useCreate();
  const rxUpdate = rxCrud.useUpdate();
  const rxDelete = rxCrud.useDelete();

  // Doctors list for prescription form
  const { data: doctorsData } = useCrud<Doctor>({
    endpoint: '/doctors',
    queryKey: 'doctors-list',
  }).useList({ pageSize: '100' });
  const doctors = doctorsData?.data || [];

  // ─── Diagnosis handlers ─────────────────────────────────
  const handleDiagOpen = (item?: Diagnosis) => {
    if (item) {
      setEditDiag(item);
      setDiagForm({
        code: item.code,
        description: item.description,
        type: item.type,
        notes: item.notes || '',
      });
    } else {
      setEditDiag(null);
      setDiagForm(emptyDiagnosis);
    }
    setDiagDialogOpen(true);
  };

  const handleDiagClose = () => {
    setDiagDialogOpen(false);
    setEditDiag(null);
    setDiagForm(emptyDiagnosis);
  };

  const handleDiagSubmit = () => {
    const payload = { ...diagForm, visitId: Number(id) };
    if (editDiag) {
      diagUpdate.mutate(
        { id: editDiag.id, data: payload },
        {
          onSuccess: () => { enqueueSnackbar('Diagnosis updated', { variant: 'success' }); handleDiagClose(); },
          onError: () => enqueueSnackbar('Failed to update diagnosis', { variant: 'error' }),
        }
      );
    } else {
      diagCreate.mutate(payload as any, {
        onSuccess: () => { enqueueSnackbar('Diagnosis added', { variant: 'success' }); handleDiagClose(); },
        onError: () => enqueueSnackbar('Failed to add diagnosis', { variant: 'error' }),
      });
    }
  };

  const handleDiagDelete = () => {
    if (!deleteDiag) return;
    diagDelete.mutate(deleteDiag.id, {
      onSuccess: () => { enqueueSnackbar('Diagnosis deleted', { variant: 'success' }); setDeleteDiag(null); },
      onError: () => enqueueSnackbar('Failed to delete diagnosis', { variant: 'error' }),
    });
  };

  // ─── Lab order handlers ─────────────────────────────────
  const handleLabOpen = (item?: LabOrder) => {
    if (item) {
      setEditLab(item);
      setLabForm({
        testName: item.testName,
        category: item.category,
        priority: item.priority,
        notes: item.notes || '',
      });
    } else {
      setEditLab(null);
      setLabForm(emptyLabOrder);
    }
    setLabDialogOpen(true);
  };

  const handleLabClose = () => {
    setLabDialogOpen(false);
    setEditLab(null);
    setLabForm(emptyLabOrder);
  };

  const handleLabSubmit = () => {
    const payload = { ...labForm, visitId: Number(id) };
    if (editLab) {
      labUpdate.mutate(
        { id: editLab.id, data: payload },
        {
          onSuccess: () => { enqueueSnackbar('Lab order updated', { variant: 'success' }); handleLabClose(); },
          onError: () => enqueueSnackbar('Failed to update lab order', { variant: 'error' }),
        }
      );
    } else {
      labCreate.mutate(payload as any, {
        onSuccess: () => { enqueueSnackbar('Lab order added', { variant: 'success' }); handleLabClose(); },
        onError: () => enqueueSnackbar('Failed to add lab order', { variant: 'error' }),
      });
    }
  };

  const handleLabDelete = () => {
    if (!deleteLab) return;
    labDelete.mutate(deleteLab.id, {
      onSuccess: () => { enqueueSnackbar('Lab order deleted', { variant: 'success' }); setDeleteLab(null); },
      onError: () => enqueueSnackbar('Failed to delete lab order', { variant: 'error' }),
    });
  };

  // ─── Prescription handlers ──────────────────────────────
  const handleRxOpen = (item?: Prescription) => {
    if (item) {
      setEditRx(item);
      setRxForm({
        doctorId: item.doctorId,
        date: item.date ? item.date.slice(0, 10) : '',
        notes: item.notes || '',
      });
    } else {
      setEditRx(null);
      setRxForm(emptyPrescription);
    }
    setRxDialogOpen(true);
  };

  const handleRxClose = () => {
    setRxDialogOpen(false);
    setEditRx(null);
    setRxForm(emptyPrescription);
  };

  const handleRxSubmit = () => {
    const payload = { ...rxForm, visitId: Number(id), doctorId: Number(rxForm.doctorId) };
    if (editRx) {
      rxUpdate.mutate(
        { id: editRx.id, data: payload },
        {
          onSuccess: () => { enqueueSnackbar('Prescription updated', { variant: 'success' }); handleRxClose(); },
          onError: () => enqueueSnackbar('Failed to update prescription', { variant: 'error' }),
        }
      );
    } else {
      rxCreate.mutate(payload as any, {
        onSuccess: () => { enqueueSnackbar('Prescription added', { variant: 'success' }); handleRxClose(); },
        onError: () => enqueueSnackbar('Failed to add prescription', { variant: 'error' }),
      });
    }
  };

  const handleRxDelete = () => {
    if (!deleteRx) return;
    rxDelete.mutate(deleteRx.id, {
      onSuccess: () => { enqueueSnackbar('Prescription deleted', { variant: 'success' }); setDeleteRx(null); },
      onError: () => enqueueSnackbar('Failed to delete prescription', { variant: 'error' }),
    });
  };

  // ─── Column definitions ─────────────────────────────────
  const diagColumns = [
    { key: 'code', label: 'Code' },
    { key: 'description', label: 'Description' },
    { key: 'type', label: 'Type' },
    { key: 'notes', label: 'Notes' },
  ];

  const labColumns = [
    { key: 'testName', label: 'Test Name' },
    { key: 'category', label: 'Category' },
    { key: 'priority', label: 'Priority', render: (row: LabOrder) => <StatusChip status={row.priority} /> },
    { key: 'status', label: 'Status', render: (row: LabOrder) => <StatusChip status={row.status} /> },
    { key: 'orderedAt', label: 'Ordered At', render: (row: LabOrder) => row.orderedAt ? new Date(row.orderedAt).toLocaleDateString() : '' },
  ];

  const rxColumns = [
    { key: 'date', label: 'Date', render: (row: Prescription) => row.date ? new Date(row.date).toLocaleDateString() : '' },
    {
      key: 'doctorName',
      label: 'Doctor',
      render: (row: Prescription) => {
        const d = row.doctor;
        return d ? `Dr. ${d.firstName} ${d.lastName}` : '';
      },
    },
    { key: 'status', label: 'Status', render: (row: Prescription) => <StatusChip status={row.status} /> },
    {
      key: 'items',
      label: 'Items',
      render: (row: Prescription) => row.items?.length ?? 0,
    },
  ];

  // ─── Overview tab content ───────────────────────────────
  const overviewContent = visit ? (
    <Card variant="outlined" sx={{ p: 3 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">Patient</Typography>
          <Typography>{visit.patient ? `${visit.patient.firstName} ${visit.patient.lastName}` : '-'}</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">Doctor</Typography>
          <Typography>{visit.doctor ? `Dr. ${visit.doctor.firstName} ${visit.doctor.lastName}` : '-'}</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">Visit Date</Typography>
          <Typography>{visit.visitDate ? new Date(visit.visitDate).toLocaleString() : '-'}</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">Chief Complaint</Typography>
          <Typography>{visit.chiefComplaint || '-'}</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">Vital Signs</Typography>
          <Typography sx={{ whiteSpace: 'pre-wrap' }}>{visit.vitalSigns || '-'}</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
          <Typography sx={{ whiteSpace: 'pre-wrap' }}>{visit.notes || '-'}</Typography>
        </Box>
      </Box>
    </Card>
  ) : null;

  // ─── Tabs ───────────────────────────────────────────────
  const tabs = [
    { label: 'Overview', content: overviewContent },
    {
      label: 'Diagnoses',
      content: (
        <>
          <NestedTable
            columns={diagColumns}
            rows={visit?.diagnoses || []}
            onAdd={() => handleDiagOpen()}
            onEdit={(row) => handleDiagOpen(row)}
            onDelete={(row) => setDeleteDiag(row)}
            addLabel="Add Diagnosis"
            emptyMessage="No diagnoses recorded."
          />
          <FormDialog
            open={diagDialogOpen}
            onClose={handleDiagClose}
            onSubmit={handleDiagSubmit}
            title={editDiag ? 'Edit Diagnosis' : 'Add Diagnosis'}
            loading={diagCreate.isPending || diagUpdate.isPending}
          >
            <TextField
              label="Code"
              required
              value={diagForm.code}
              onChange={(e) => setDiagForm({ ...diagForm, code: e.target.value })}
            />
            <TextField
              label="Description"
              required
              value={diagForm.description}
              onChange={(e) => setDiagForm({ ...diagForm, description: e.target.value })}
            />
            <TextField
              select
              label="Type"
              required
              value={diagForm.type}
              onChange={(e) => setDiagForm({ ...diagForm, type: e.target.value })}
            >
              {diagnosisTypes.map((t) => (
                <MenuItem key={t} value={t}>{t}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Notes"
              multiline
              rows={3}
              value={diagForm.notes}
              onChange={(e) => setDiagForm({ ...diagForm, notes: e.target.value })}
            />
          </FormDialog>
          <ConfirmDialog
            open={!!deleteDiag}
            onClose={() => setDeleteDiag(null)}
            onConfirm={handleDiagDelete}
            title="Delete Diagnosis"
            message="Are you sure you want to delete this diagnosis?"
            loading={diagDelete.isPending}
          />
        </>
      ),
    },
    {
      label: 'Lab Orders',
      content: (
        <>
          <NestedTable
            columns={labColumns}
            rows={visit?.labOrders || []}
            onAdd={() => handleLabOpen()}
            onEdit={(row) => handleLabOpen(row)}
            onDelete={(row) => setDeleteLab(row)}
            onRowClick={(row) => navigate(`/lab-orders/${row.id}`)}
            addLabel="Add Lab Order"
            emptyMessage="No lab orders."
          />
          <FormDialog
            open={labDialogOpen}
            onClose={handleLabClose}
            onSubmit={handleLabSubmit}
            title={editLab ? 'Edit Lab Order' : 'Add Lab Order'}
            loading={labCreate.isPending || labUpdate.isPending}
          >
            <TextField
              label="Test Name"
              required
              value={labForm.testName}
              onChange={(e) => setLabForm({ ...labForm, testName: e.target.value })}
            />
            <TextField
              select
              label="Category"
              required
              value={labForm.category}
              onChange={(e) => setLabForm({ ...labForm, category: e.target.value })}
            >
              {labCategories.map((c) => (
                <MenuItem key={c} value={c}>{c}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Priority"
              required
              value={labForm.priority}
              onChange={(e) => setLabForm({ ...labForm, priority: e.target.value })}
            >
              {labPriorities.map((p) => (
                <MenuItem key={p} value={p}>{p}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Notes"
              multiline
              rows={3}
              value={labForm.notes}
              onChange={(e) => setLabForm({ ...labForm, notes: e.target.value })}
            />
          </FormDialog>
          <ConfirmDialog
            open={!!deleteLab}
            onClose={() => setDeleteLab(null)}
            onConfirm={handleLabDelete}
            title="Delete Lab Order"
            message="Are you sure you want to delete this lab order?"
            loading={labDelete.isPending}
          />
        </>
      ),
    },
    {
      label: 'Prescriptions',
      content: (
        <>
          <NestedTable
            columns={rxColumns}
            rows={visit?.prescriptions || []}
            onAdd={() => handleRxOpen()}
            onEdit={(row) => handleRxOpen(row)}
            onDelete={(row) => setDeleteRx(row)}
            onRowClick={(row) => navigate(`/prescriptions/${row.id}`)}
            addLabel="Add Prescription"
            emptyMessage="No prescriptions."
          />
          <FormDialog
            open={rxDialogOpen}
            onClose={handleRxClose}
            onSubmit={handleRxSubmit}
            title={editRx ? 'Edit Prescription' : 'Add Prescription'}
            loading={rxCreate.isPending || rxUpdate.isPending}
          >
            <TextField
              select
              label="Doctor"
              required
              value={rxForm.doctorId}
              onChange={(e) => setRxForm({ ...rxForm, doctorId: Number(e.target.value) })}
            >
              {doctors.map((d) => (
                <MenuItem key={d.id} value={d.id}>
                  Dr. {d.firstName} {d.lastName} - {d.specialization}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Date"
              type="date"
              required
              value={rxForm.date}
              onChange={(e) => setRxForm({ ...rxForm, date: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Notes"
              multiline
              rows={3}
              value={rxForm.notes}
              onChange={(e) => setRxForm({ ...rxForm, notes: e.target.value })}
            />
          </FormDialog>
          <ConfirmDialog
            open={!!deleteRx}
            onClose={() => setDeleteRx(null)}
            onConfirm={handleRxDelete}
            title="Delete Prescription"
            message="Are you sure you want to delete this prescription?"
            loading={rxDelete.isPending}
          />
        </>
      ),
    },
  ];

  return (
    <DetailPageLayout
      header={
        <PageHeader
          title={`Visit #${id}`}
          breadcrumbs={[
            { label: 'Visits', to: '/visits' },
            { label: `Visit #${id}` },
          ]}
        />
      }
      tabs={tabs}
      loading={isLoading}
      error={isError}
    />
  );
}
