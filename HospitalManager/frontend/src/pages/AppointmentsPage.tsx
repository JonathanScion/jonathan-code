import { useState } from 'react';
import { Card, Box, TextField, MenuItem, IconButton, Button } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { GridColDef } from '@mui/x-data-grid';
import { useSnackbar } from 'notistack';
import { useCrud } from '../hooks/useCrud';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import FormDialog from '../components/FormDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusChip from '../components/StatusChip';
import { Appointment, Patient, Doctor } from '../types';

const STATUSES = ['ALL', 'SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;
const TYPES = ['CONSULTATION', 'FOLLOW_UP', 'EMERGENCY', 'ROUTINE'] as const;

const emptyForm = {
  patientId: '' as number | '',
  doctorId: '' as number | '',
  dateTime: '',
  duration: 30,
  type: 'CONSULTATION' as string,
  notes: '',
};

export default function AppointmentsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Appointment | null>(null);
  const [deleteItem, setDeleteItem] = useState<Appointment | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [formData, setFormData] = useState(emptyForm);

  const { enqueueSnackbar } = useSnackbar();

  const { useList, useCreate, useUpdate, useDelete, useUpdateStatus } = useCrud<Appointment>({
    endpoint: '/appointments',
    queryKey: 'appointments',
  });

  const { data, isLoading } = useList({
    page: String(paginationModel.page + 1),
    pageSize: String(paginationModel.pageSize),
    search,
    ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
  });

  const { data: patientsData } = useCrud<Patient>({
    endpoint: '/patients',
    queryKey: 'patients-list',
  }).useList({ pageSize: '100' });

  const { data: doctorsData } = useCrud<Doctor>({
    endpoint: '/doctors',
    queryKey: 'doctors-list',
  }).useList({ pageSize: '100' });

  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();
  const statusMutation = useUpdateStatus();

  const patients = patientsData?.data || [];
  const doctors = doctorsData?.data || [];

  const handleOpen = (item?: Appointment) => {
    if (item) {
      setEditItem(item);
      setFormData({
        patientId: item.patientId,
        doctorId: item.doctorId,
        dateTime: item.dateTime ? item.dateTime.slice(0, 16) : '',
        duration: item.duration,
        type: item.type,
        notes: item.notes || '',
      });
    } else {
      setEditItem(null);
      setFormData(emptyForm);
    }
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditItem(null);
    setFormData(emptyForm);
  };

  const handleSubmit = () => {
    const payload = {
      ...formData,
      patientId: Number(formData.patientId),
      doctorId: Number(formData.doctorId),
      duration: Number(formData.duration),
    };

    if (editItem) {
      updateMutation.mutate(
        { id: editItem.id, data: payload },
        {
          onSuccess: () => {
            enqueueSnackbar('Appointment updated successfully', { variant: 'success' });
            handleClose();
          },
          onError: () => enqueueSnackbar('Failed to update appointment', { variant: 'error' }),
        }
      );
    } else {
      createMutation.mutate(payload as any, {
        onSuccess: () => {
          enqueueSnackbar('Appointment created successfully', { variant: 'success' });
          handleClose();
        },
        onError: () => enqueueSnackbar('Failed to create appointment', { variant: 'error' }),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteItem) return;
    deleteMutation.mutate(deleteItem.id, {
      onSuccess: () => {
        enqueueSnackbar('Appointment deleted successfully', { variant: 'success' });
        setDeleteItem(null);
      },
      onError: () => enqueueSnackbar('Failed to delete appointment', { variant: 'error' }),
    });
  };

  const handleStatusChange = (id: number, status: string) => {
    statusMutation.mutate(
      { id, status },
      {
        onSuccess: () => enqueueSnackbar(`Appointment ${status.toLowerCase().replace(/_/g, ' ')}`, { variant: 'success' }),
        onError: () => enqueueSnackbar('Failed to update status', { variant: 'error' }),
      }
    );
  };

  const renderStatusActions = (row: Appointment) => {
    const buttons: React.ReactNode[] = [];

    switch (row.status) {
      case 'SCHEDULED':
        buttons.push(
          <Button key="confirm" size="small" variant="outlined" color="primary" onClick={(e) => { e.stopPropagation(); handleStatusChange(row.id, 'CONFIRMED'); }}>
            Confirm
          </Button>,
          <Button key="cancel" size="small" variant="outlined" color="error" onClick={(e) => { e.stopPropagation(); handleStatusChange(row.id, 'CANCELLED'); }}>
            Cancel
          </Button>
        );
        break;
      case 'CONFIRMED':
        buttons.push(
          <Button key="start" size="small" variant="outlined" color="warning" onClick={(e) => { e.stopPropagation(); handleStatusChange(row.id, 'IN_PROGRESS'); }}>
            Start
          </Button>,
          <Button key="cancel" size="small" variant="outlined" color="error" onClick={(e) => { e.stopPropagation(); handleStatusChange(row.id, 'CANCELLED'); }}>
            Cancel
          </Button>
        );
        break;
      case 'IN_PROGRESS':
        buttons.push(
          <Button key="complete" size="small" variant="outlined" color="success" onClick={(e) => { e.stopPropagation(); handleStatusChange(row.id, 'COMPLETED'); }}>
            Complete
          </Button>
        );
        break;
    }

    return buttons;
  };

  const columns: GridColDef[] = [
    {
      field: 'patientName',
      headerName: 'Patient',
      flex: 1,
      valueGetter: (_value, row) => {
        const p = row.patient;
        return p ? `${p.firstName} ${p.lastName}` : '';
      },
    },
    {
      field: 'doctorName',
      headerName: 'Doctor',
      flex: 1,
      valueGetter: (_value, row) => {
        const d = row.doctor;
        return d ? `Dr. ${d.firstName} ${d.lastName}` : '';
      },
    },
    {
      field: 'dateTime',
      headerName: 'Date & Time',
      flex: 1,
      valueFormatter: (value) => value ? new Date(value).toLocaleString() : '',
    },
    {
      field: 'duration',
      headerName: 'Duration',
      width: 100,
      valueFormatter: (value) => `${value} min`,
    },
    {
      field: 'type',
      headerName: 'Type',
      width: 130,
      valueFormatter: (value: string) => value ? value.replace(/_/g, ' ') : '',
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 130,
      renderCell: (params) => <StatusChip status={params.value} />,
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 320,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {renderStatusActions(params.row)}
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleOpen(params.row);
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={(e) => {
              e.stopPropagation();
              setDeleteItem(params.row);
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Appointments"
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Appointments' }]}
        onAdd={() => handleOpen()}
        addLabel="Add Appointment"
      />

      <Card sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ width: 200 }}
          >
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {s === 'ALL' ? 'All Statuses' : s.replace(/_/g, ' ')}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <DataTable
          columns={columns}
          rows={data?.data || []}
          total={data?.pagination.total || 0}
          loading={isLoading}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          onSearch={setSearch}
          searchPlaceholder="Search appointments..."
        />
      </Card>

      <FormDialog
        open={dialogOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        title={editItem ? 'Edit Appointment' : 'Add Appointment'}
        loading={createMutation.isPending || updateMutation.isPending}
      >
        <TextField
          select
          label="Patient"
          required
          value={formData.patientId}
          onChange={(e) => setFormData({ ...formData, patientId: Number(e.target.value) })}
        >
          {patients.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.firstName} {p.lastName}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Doctor"
          required
          value={formData.doctorId}
          onChange={(e) => setFormData({ ...formData, doctorId: Number(e.target.value) })}
        >
          {doctors.map((d) => (
            <MenuItem key={d.id} value={d.id}>
              Dr. {d.firstName} {d.lastName} - {d.specialization}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Date & Time"
          type="datetime-local"
          required
          value={formData.dateTime}
          onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Duration (minutes)"
          type="number"
          required
          value={formData.duration}
          onChange={(e) => setFormData({ ...formData, duration: Number(e.target.value) })}
          inputProps={{ min: 5, step: 5 }}
        />
        <TextField
          select
          label="Type"
          required
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
        >
          {TYPES.map((t) => (
            <MenuItem key={t} value={t}>
              {t.replace(/_/g, ' ')}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Notes"
          multiline
          rows={3}
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />
      </FormDialog>

      <ConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDelete}
        title="Delete Appointment"
        message={`Are you sure you want to delete this appointment? This action cannot be undone.`}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
