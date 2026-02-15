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
import { Admission, Patient, Doctor, Room, Bed } from '../types';

const STATUSES = ['ALL', 'ADMITTED', 'DISCHARGED', 'TRANSFERRED'] as const;

const emptyForm = {
  patientId: '' as number | '',
  doctorId: '' as number | '',
  roomId: '' as number | '',
  bedId: '' as number | '',
  admitDate: '',
  reason: '',
  notes: '',
};

export default function AdmissionsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Admission | null>(null);
  const [deleteItem, setDeleteItem] = useState<Admission | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [formData, setFormData] = useState(emptyForm);

  const { enqueueSnackbar } = useSnackbar();

  const { useList, useCreate, useUpdate, useDelete, useUpdateStatus } = useCrud<Admission>({
    endpoint: '/admissions',
    queryKey: 'admissions',
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

  const { data: roomsData } = useCrud<Room>({
    endpoint: '/rooms',
    queryKey: 'rooms-list',
  }).useList({ pageSize: '100' });

  const selectedRoomId = formData.roomId;
  const { data: bedsData } = useCrud<Bed>({
    endpoint: '/beds',
    queryKey: 'beds-for-room',
  }).useList(
    selectedRoomId
      ? { roomId: String(selectedRoomId), pageSize: '100' }
      : { pageSize: '0' }
  );

  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();
  const statusMutation = useUpdateStatus();

  const patients = patientsData?.data || [];
  const doctors = doctorsData?.data || [];
  const rooms = roomsData?.data || [];
  const beds = selectedRoomId ? (bedsData?.data || []) : [];

  const handleOpen = (item?: Admission) => {
    if (item) {
      setEditItem(item);
      setFormData({
        patientId: item.patientId,
        doctorId: item.doctorId,
        roomId: item.roomId,
        bedId: item.bedId || '',
        admitDate: item.admitDate ? item.admitDate.slice(0, 10) : '',
        reason: item.reason || '',
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
      roomId: Number(formData.roomId),
      bedId: formData.bedId ? Number(formData.bedId) : null,
    };

    if (editItem) {
      updateMutation.mutate(
        { id: editItem.id, data: payload },
        {
          onSuccess: () => {
            enqueueSnackbar('Admission updated successfully', { variant: 'success' });
            handleClose();
          },
          onError: () => enqueueSnackbar('Failed to update admission', { variant: 'error' }),
        }
      );
    } else {
      createMutation.mutate(payload as any, {
        onSuccess: () => {
          enqueueSnackbar('Admission created successfully', { variant: 'success' });
          handleClose();
        },
        onError: () => enqueueSnackbar('Failed to create admission', { variant: 'error' }),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteItem) return;
    deleteMutation.mutate(deleteItem.id, {
      onSuccess: () => {
        enqueueSnackbar('Admission deleted successfully', { variant: 'success' });
        setDeleteItem(null);
      },
      onError: () => enqueueSnackbar('Failed to delete admission', { variant: 'error' }),
    });
  };

  const handleStatusChange = (id: number, status: string) => {
    statusMutation.mutate(
      { id, status },
      {
        onSuccess: () => enqueueSnackbar(`Patient ${status.toLowerCase()}`, { variant: 'success' }),
        onError: () => enqueueSnackbar('Failed to update status', { variant: 'error' }),
      }
    );
  };

  const handleRoomChange = (roomId: number | '') => {
    setFormData({ ...formData, roomId, bedId: '' });
  };

  const renderStatusActions = (row: Admission) => {
    if (row.status !== 'ADMITTED') return null;

    return (
      <>
        <Button
          size="small"
          variant="outlined"
          color="success"
          onClick={(e) => {
            e.stopPropagation();
            handleStatusChange(row.id, 'DISCHARGED');
          }}
        >
          Discharge
        </Button>
        <Button
          size="small"
          variant="outlined"
          color="info"
          onClick={(e) => {
            e.stopPropagation();
            handleStatusChange(row.id, 'TRANSFERRED');
          }}
        >
          Transfer
        </Button>
      </>
    );
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
      field: 'roomNumber',
      headerName: 'Room',
      width: 100,
      valueGetter: (_value, row) => row.room?.number || '',
    },
    {
      field: 'bedNumber',
      headerName: 'Bed',
      width: 100,
      valueGetter: (_value, row) => row.bed?.number || '',
    },
    {
      field: 'admitDate',
      headerName: 'Admit Date',
      flex: 1,
      valueFormatter: (value) => value ? new Date(value).toLocaleDateString() : '',
    },
    {
      field: 'dischargeDate',
      headerName: 'Discharge Date',
      flex: 1,
      valueFormatter: (value) => value ? new Date(value).toLocaleDateString() : '-',
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
      width: 280,
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
        title="Admissions"
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Admissions' }]}
        onAdd={() => handleOpen()}
        addLabel="Add Admission"
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
                {s === 'ALL' ? 'All Statuses' : s}
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
          searchPlaceholder="Search admissions..."
        />
      </Card>

      <FormDialog
        open={dialogOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        title={editItem ? 'Edit Admission' : 'Add Admission'}
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
          select
          label="Room"
          required
          value={formData.roomId}
          onChange={(e) => handleRoomChange(Number(e.target.value))}
        >
          {rooms.map((r) => (
            <MenuItem key={r.id} value={r.id}>
              Room {r.number} (Floor {r.floor} - {r.type})
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Bed"
          value={formData.bedId}
          onChange={(e) => setFormData({ ...formData, bedId: Number(e.target.value) })}
          disabled={!selectedRoomId}
          helperText={!selectedRoomId ? 'Select a room first' : undefined}
        >
          {beds.map((b) => (
            <MenuItem key={b.id} value={b.id}>
              Bed {b.number} ({b.type} - {b.status})
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Admit Date"
          type="date"
          required
          value={formData.admitDate}
          onChange={(e) => setFormData({ ...formData, admitDate: e.target.value })}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Reason"
          multiline
          rows={2}
          value={formData.reason}
          onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
        />
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
        title="Delete Admission"
        message={`Are you sure you want to delete this admission record? This action cannot be undone.`}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
