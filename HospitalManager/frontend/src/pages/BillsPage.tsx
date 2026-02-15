import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Box, TextField, MenuItem, IconButton } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { GridColDef } from '@mui/x-data-grid';
import { useSnackbar } from 'notistack';
import { useCrud } from '../hooks/useCrud';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import FormDialog from '../components/FormDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusChip from '../components/StatusChip';
import { Bill, Patient } from '../types';

const STATUSES = ['ALL', 'PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'] as const;

const emptyForm = {
  patientId: '' as number | '',
  date: '',
  dueDate: '',
  notes: '',
};

export default function BillsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Bill | null>(null);
  const [deleteItem, setDeleteItem] = useState<Bill | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [formData, setFormData] = useState(emptyForm);

  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();

  const { useList, useCreate, useUpdate, useDelete } = useCrud<Bill>({
    endpoint: '/bills',
    queryKey: 'bills',
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

  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const patients = patientsData?.data || [];

  const handleOpen = (item?: Bill) => {
    if (item) {
      setEditItem(item);
      setFormData({
        patientId: item.patientId,
        date: item.date ? item.date.slice(0, 10) : '',
        dueDate: item.dueDate ? item.dueDate.slice(0, 10) : '',
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
    };

    if (editItem) {
      updateMutation.mutate(
        { id: editItem.id, data: payload },
        {
          onSuccess: () => {
            enqueueSnackbar('Bill updated successfully', { variant: 'success' });
            handleClose();
          },
          onError: () => enqueueSnackbar('Failed to update bill', { variant: 'error' }),
        }
      );
    } else {
      createMutation.mutate(payload as any, {
        onSuccess: () => {
          enqueueSnackbar('Bill created successfully', { variant: 'success' });
          handleClose();
        },
        onError: () => enqueueSnackbar('Failed to create bill', { variant: 'error' }),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteItem) return;
    deleteMutation.mutate(deleteItem.id, {
      onSuccess: () => {
        enqueueSnackbar('Bill deleted successfully', { variant: 'success' });
        setDeleteItem(null);
      },
      onError: () => enqueueSnackbar('Failed to delete bill', { variant: 'error' }),
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
      field: 'date',
      headerName: 'Date',
      flex: 1,
      valueFormatter: (value) => value ? new Date(value).toLocaleDateString() : '',
    },
    {
      field: 'totalAmount',
      headerName: 'Total Amount',
      width: 140,
      valueFormatter: (value) => `$${Number(value).toFixed(2)}`,
    },
    {
      field: 'paidAmount',
      headerName: 'Paid Amount',
      width: 140,
      valueFormatter: (value) => `$${Number(value).toFixed(2)}`,
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
        title="Bills"
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Bills' }]}
        onAdd={() => handleOpen()}
        addLabel="Add Bill"
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
          searchPlaceholder="Search bills..."
          onRowClick={(row) => navigate(`/bills/${row.id}`)}
        />
      </Card>

      <FormDialog
        open={dialogOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        title={editItem ? 'Edit Bill' : 'Add Bill'}
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
          label="Date"
          type="date"
          required
          value={formData.date}
          onChange={(e) => setFormData({ ...formData, date: e.target.value })}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Due Date"
          type="date"
          value={formData.dueDate}
          onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
          InputLabelProps={{ shrink: true }}
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
        title="Delete Bill"
        message="Are you sure you want to delete this bill? This action cannot be undone."
        loading={deleteMutation.isPending}
      />
    </>
  );
}
