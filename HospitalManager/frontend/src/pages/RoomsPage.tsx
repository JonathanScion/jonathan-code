import { useState } from 'react';
import { Card, IconButton, TextField, MenuItem } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useCrud } from '../hooks/useCrud';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import FormDialog from '../components/FormDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusChip from '../components/StatusChip';
import { Room } from '../types';

const roomTypes = ['WARD', 'PRIVATE', 'ICU', 'OPERATING', 'EMERGENCY'];
const roomStatuses = ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE'];

const emptyForm = { number: '', floor: 1, type: 'WARD', status: 'AVAILABLE' };

export default function RoomsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Room | null>(null);
  const [deleteItem, setDeleteItem] = useState<Room | null>(null);
  const [search, setSearch] = useState('');
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [formData, setFormData] = useState(emptyForm);

  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { useList, useCreate, useUpdate, useDelete } = useCrud<Room>({
    endpoint: '/rooms',
    queryKey: 'rooms',
  });

  const { data, isLoading } = useList({
    page: String(paginationModel.page + 1),
    pageSize: String(paginationModel.pageSize),
    search,
  });

  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const handleOpen = (item?: Room) => {
    if (item) {
      setEditItem(item);
      setFormData({
        number: item.number,
        floor: item.floor,
        type: item.type,
        status: item.status,
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
    const submitData = { ...formData, floor: Number(formData.floor) };
    if (editItem) {
      updateMutation.mutate(
        { id: editItem.id, data: submitData },
        {
          onSuccess: () => {
            enqueueSnackbar('Room updated successfully', { variant: 'success' });
            handleClose();
          },
          onError: () => enqueueSnackbar('Failed to update room', { variant: 'error' }),
        }
      );
    } else {
      createMutation.mutate(submitData as any, {
        onSuccess: () => {
          enqueueSnackbar('Room created successfully', { variant: 'success' });
          handleClose();
        },
        onError: () => enqueueSnackbar('Failed to create room', { variant: 'error' }),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteItem) return;
    deleteMutation.mutate(deleteItem.id, {
      onSuccess: () => {
        enqueueSnackbar('Room deleted successfully', { variant: 'success' });
        setDeleteItem(null);
      },
      onError: () => enqueueSnackbar('Failed to delete room', { variant: 'error' }),
    });
  };

  const columns: GridColDef[] = [
    { field: 'number', headerName: 'Room Number', flex: 1 },
    { field: 'floor', headerName: 'Floor', width: 100 },
    { field: 'type', headerName: 'Type', width: 140 },
    {
      field: 'status',
      headerName: 'Status',
      width: 140,
      renderCell: (params) => <StatusChip status={params.value} />,
    },
    {
      field: 'beds',
      headerName: 'Beds',
      width: 100,
      valueGetter: (_value, row) => row._count?.beds ?? 0,
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
        title="Rooms"
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Rooms' }]}
        onAdd={() => handleOpen()}
        addLabel="Add Room"
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
          searchPlaceholder="Search rooms..."
          onRowClick={(row) => navigate(`/rooms/${row.id}`)}
        />
      </Card>

      <FormDialog
        open={dialogOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        title={editItem ? 'Edit Room' : 'Add Room'}
        loading={createMutation.isPending || updateMutation.isPending}
      >
        <TextField
          label="Room Number"
          required
          value={formData.number}
          onChange={(e) => setFormData({ ...formData, number: e.target.value })}
        />
        <TextField
          label="Floor"
          type="number"
          value={formData.floor}
          onChange={(e) => setFormData({ ...formData, floor: Number(e.target.value) })}
        />
        <TextField
          label="Type"
          select
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
        >
          {roomTypes.map((t) => (
            <MenuItem key={t} value={t}>{t}</MenuItem>
          ))}
        </TextField>
        <TextField
          label="Status"
          select
          value={formData.status}
          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
        >
          {roomStatuses.map((s) => (
            <MenuItem key={s} value={s}>{s}</MenuItem>
          ))}
        </TextField>
      </FormDialog>

      <ConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDelete}
        title="Delete Room"
        message={`Are you sure you want to delete room "${deleteItem?.number}"? This action cannot be undone.`}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
