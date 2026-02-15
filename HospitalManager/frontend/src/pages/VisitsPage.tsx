import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, TextField, MenuItem, IconButton } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { GridColDef } from '@mui/x-data-grid';
import { useSnackbar } from 'notistack';
import { useCrud } from '../hooks/useCrud';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import FormDialog from '../components/FormDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { Visit, Patient, Doctor } from '../types';

const emptyForm = {
  patientId: '' as number | '',
  doctorId: '' as number | '',
  visitDate: '',
  chiefComplaint: '',
  vitalSigns: '',
  notes: '',
};

export default function VisitsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Visit | null>(null);
  const [deleteItem, setDeleteItem] = useState<Visit | null>(null);
  const [search, setSearch] = useState('');
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [formData, setFormData] = useState(emptyForm);

  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const { useList, useCreate, useUpdate, useDelete } = useCrud<Visit>({
    endpoint: '/visits',
    queryKey: 'visits',
  });

  const { data, isLoading } = useList({
    page: String(paginationModel.page + 1),
    pageSize: String(paginationModel.pageSize),
    search,
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

  const patients = patientsData?.data || [];
  const doctors = doctorsData?.data || [];

  const handleOpen = (item?: Visit) => {
    if (item) {
      setEditItem(item);
      setFormData({
        patientId: item.patientId,
        doctorId: item.doctorId,
        visitDate: item.visitDate ? item.visitDate.slice(0, 16) : '',
        chiefComplaint: item.chiefComplaint || '',
        vitalSigns: item.vitalSigns || '',
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
    };

    if (editItem) {
      updateMutation.mutate(
        { id: editItem.id, data: payload },
        {
          onSuccess: () => {
            enqueueSnackbar('Visit updated successfully', { variant: 'success' });
            handleClose();
          },
          onError: () => enqueueSnackbar('Failed to update visit', { variant: 'error' }),
        }
      );
    } else {
      createMutation.mutate(payload as any, {
        onSuccess: () => {
          enqueueSnackbar('Visit created successfully', { variant: 'success' });
          handleClose();
        },
        onError: () => enqueueSnackbar('Failed to create visit', { variant: 'error' }),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteItem) return;
    deleteMutation.mutate(deleteItem.id, {
      onSuccess: () => {
        enqueueSnackbar('Visit deleted successfully', { variant: 'success' });
        setDeleteItem(null);
      },
      onError: () => enqueueSnackbar('Failed to delete visit', { variant: 'error' }),
    });
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
      field: 'visitDate',
      headerName: 'Visit Date',
      flex: 1,
      valueFormatter: (value) => value ? new Date(value).toLocaleDateString() : '',
    },
    {
      field: 'chiefComplaint',
      headerName: 'Chief Complaint',
      flex: 1.5,
    },
    {
      field: 'diagnoses',
      headerName: 'Diagnoses',
      width: 110,
      valueGetter: (_value, row) => row._count?.diagnoses ?? row.diagnoses?.length ?? 0,
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      filterable: false,
      renderCell: (params) => (
        <>
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
        </>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Visits"
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Visits' }]}
        onAdd={() => handleOpen()}
        addLabel="Add Visit"
      />

      <Card sx={{ p: 2 }}>
        <DataTable
          columns={columns}
          rows={data?.data || []}
          total={data?.pagination.total || 0}
          loading={isLoading}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          onSearch={setSearch}
          searchPlaceholder="Search visits..."
          onRowClick={(row) => navigate(`/visits/${row.id}`)}
        />
      </Card>

      <FormDialog
        open={dialogOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        title={editItem ? 'Edit Visit' : 'Add Visit'}
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
          label="Visit Date"
          type="datetime-local"
          required
          value={formData.visitDate}
          onChange={(e) => setFormData({ ...formData, visitDate: e.target.value })}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Chief Complaint"
          multiline
          rows={3}
          value={formData.chiefComplaint}
          onChange={(e) => setFormData({ ...formData, chiefComplaint: e.target.value })}
        />
        <TextField
          label="Vital Signs"
          multiline
          rows={2}
          value={formData.vitalSigns}
          onChange={(e) => setFormData({ ...formData, vitalSigns: e.target.value })}
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
        title="Delete Visit"
        message="Are you sure you want to delete this visit? This action cannot be undone."
        loading={deleteMutation.isPending}
      />
    </>
  );
}
