import { useState } from 'react';
import { Card, IconButton, TextField } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useCrud } from '../hooks/useCrud';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import FormDialog from '../components/FormDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { Supplier } from '../types';

const emptyForm = { name: '', contact: '', email: '', phone: '', address: '' };

export default function SuppliersPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Supplier | null>(null);
  const [deleteItem, setDeleteItem] = useState<Supplier | null>(null);
  const [search, setSearch] = useState('');
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [formData, setFormData] = useState(emptyForm);

  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { useList, useCreate, useUpdate, useDelete } = useCrud<Supplier>({
    endpoint: '/suppliers',
    queryKey: 'suppliers',
  });

  const { data, isLoading } = useList({
    page: String(paginationModel.page + 1),
    pageSize: String(paginationModel.pageSize),
    search,
  });

  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const handleOpen = (item?: Supplier) => {
    if (item) {
      setEditItem(item);
      setFormData({
        name: item.name,
        contact: item.contact || '',
        email: item.email || '',
        phone: item.phone || '',
        address: item.address || '',
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
    if (editItem) {
      updateMutation.mutate(
        { id: editItem.id, data: formData },
        {
          onSuccess: () => {
            enqueueSnackbar('Supplier updated successfully', { variant: 'success' });
            handleClose();
          },
          onError: () => enqueueSnackbar('Failed to update supplier', { variant: 'error' }),
        }
      );
    } else {
      createMutation.mutate(formData as any, {
        onSuccess: () => {
          enqueueSnackbar('Supplier created successfully', { variant: 'success' });
          handleClose();
        },
        onError: () => enqueueSnackbar('Failed to create supplier', { variant: 'error' }),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteItem) return;
    deleteMutation.mutate(deleteItem.id, {
      onSuccess: () => {
        enqueueSnackbar('Supplier deleted successfully', { variant: 'success' });
        setDeleteItem(null);
      },
      onError: () => enqueueSnackbar('Failed to delete supplier', { variant: 'error' }),
    });
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', flex: 1 },
    { field: 'contact', headerName: 'Contact', flex: 1 },
    { field: 'email', headerName: 'Email', flex: 1 },
    { field: 'phone', headerName: 'Phone', width: 140 },
    {
      field: 'inventoryItems',
      headerName: 'Inventory',
      width: 100,
      valueGetter: (_value, row) => row._count?.inventoryItems ?? 0,
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
        title="Suppliers"
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Suppliers' }]}
        onAdd={() => handleOpen()}
        addLabel="Add Supplier"
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
          searchPlaceholder="Search suppliers..."
          onRowClick={(row) => navigate(`/suppliers/${row.id}`)}
        />
      </Card>

      <FormDialog
        open={dialogOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        title={editItem ? 'Edit Supplier' : 'Add Supplier'}
        loading={createMutation.isPending || updateMutation.isPending}
      >
        <TextField
          label="Name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <TextField
          label="Contact Person"
          value={formData.contact}
          onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
        />
        <TextField
          label="Email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        />
        <TextField
          label="Phone"
          value={formData.phone}
          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
        />
        <TextField
          label="Address"
          multiline
          rows={3}
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
        />
      </FormDialog>

      <ConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDelete}
        title="Delete Supplier"
        message={`Are you sure you want to delete "${deleteItem?.name}"? This action cannot be undone.`}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
