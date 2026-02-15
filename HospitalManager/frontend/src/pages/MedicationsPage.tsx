import { useState } from 'react';
import { Card, IconButton, TextField, MenuItem, FormControlLabel, Switch, Chip } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { useSnackbar } from 'notistack';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useCrud } from '../hooks/useCrud';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import FormDialog from '../components/FormDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { Medication } from '../types';

const dosageForms = ['TABLET', 'CAPSULE', 'INJECTION', 'SYRUP', 'CREAM', 'INHALER'];

const emptyForm = {
  name: '',
  genericName: '',
  manufacturer: '',
  dosageForm: 'TABLET',
  strength: '',
  price: 0,
  requiresRx: false,
};

export default function MedicationsPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<Medication | null>(null);
  const [deleteItem, setDeleteItem] = useState<Medication | null>(null);
  const [search, setSearch] = useState('');
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [formData, setFormData] = useState(emptyForm);

  const { enqueueSnackbar } = useSnackbar();
  const { useList, useCreate, useUpdate, useDelete } = useCrud<Medication>({
    endpoint: '/medications',
    queryKey: 'medications',
  });

  const { data, isLoading } = useList({
    page: String(paginationModel.page + 1),
    pageSize: String(paginationModel.pageSize),
    search,
  });

  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const handleOpen = (item?: Medication) => {
    if (item) {
      setEditItem(item);
      setFormData({
        name: item.name,
        genericName: item.genericName || '',
        manufacturer: item.manufacturer || '',
        dosageForm: item.dosageForm,
        strength: item.strength,
        price: item.price,
        requiresRx: item.requiresRx,
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
    const submitData = { ...formData, price: Number(formData.price) };
    if (editItem) {
      updateMutation.mutate(
        { id: editItem.id, data: submitData },
        {
          onSuccess: () => {
            enqueueSnackbar('Medication updated successfully', { variant: 'success' });
            handleClose();
          },
          onError: () => enqueueSnackbar('Failed to update medication', { variant: 'error' }),
        }
      );
    } else {
      createMutation.mutate(submitData as any, {
        onSuccess: () => {
          enqueueSnackbar('Medication created successfully', { variant: 'success' });
          handleClose();
        },
        onError: () => enqueueSnackbar('Failed to create medication', { variant: 'error' }),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteItem) return;
    deleteMutation.mutate(deleteItem.id, {
      onSuccess: () => {
        enqueueSnackbar('Medication deleted successfully', { variant: 'success' });
        setDeleteItem(null);
      },
      onError: () => enqueueSnackbar('Failed to delete medication', { variant: 'error' }),
    });
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', flex: 1 },
    { field: 'genericName', headerName: 'Generic Name', flex: 1 },
    { field: 'dosageForm', headerName: 'Dosage Form', width: 140 },
    { field: 'strength', headerName: 'Strength', width: 120 },
    {
      field: 'price',
      headerName: 'Price',
      width: 100,
      valueFormatter: (value: number) => `$${value.toFixed(2)}`,
    },
    {
      field: 'requiresRx',
      headerName: 'Requires Rx',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Yes' : 'No'}
          color={params.value ? 'warning' : 'default'}
          size="small"
        />
      ),
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
        title="Medications"
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Medications' }]}
        onAdd={() => handleOpen()}
        addLabel="Add Medication"
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
          searchPlaceholder="Search medications..."
        />
      </Card>

      <FormDialog
        open={dialogOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        title={editItem ? 'Edit Medication' : 'Add Medication'}
        loading={createMutation.isPending || updateMutation.isPending}
      >
        <TextField
          label="Name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <TextField
          label="Generic Name"
          value={formData.genericName}
          onChange={(e) => setFormData({ ...formData, genericName: e.target.value })}
        />
        <TextField
          label="Manufacturer"
          value={formData.manufacturer}
          onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })}
        />
        <TextField
          label="Dosage Form"
          select
          value={formData.dosageForm}
          onChange={(e) => setFormData({ ...formData, dosageForm: e.target.value })}
        >
          {dosageForms.map((d) => (
            <MenuItem key={d} value={d}>{d}</MenuItem>
          ))}
        </TextField>
        <TextField
          label="Strength"
          required
          value={formData.strength}
          onChange={(e) => setFormData({ ...formData, strength: e.target.value })}
        />
        <TextField
          label="Price"
          type="number"
          value={formData.price}
          onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
          inputProps={{ min: 0, step: 0.01 }}
        />
        <FormControlLabel
          control={
            <Switch
              checked={formData.requiresRx}
              onChange={(e) => setFormData({ ...formData, requiresRx: e.target.checked })}
            />
          }
          label="Requires Prescription"
        />
      </FormDialog>

      <ConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDelete}
        title="Delete Medication"
        message={`Are you sure you want to delete "${deleteItem?.name}"? This action cannot be undone.`}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
