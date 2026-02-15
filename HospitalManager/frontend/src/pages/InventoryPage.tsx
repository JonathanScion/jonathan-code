import { useState } from 'react';
import { Card, Box, TextField, MenuItem, IconButton } from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { GridColDef } from '@mui/x-data-grid';
import { useSnackbar } from 'notistack';
import { useCrud } from '../hooks/useCrud';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import FormDialog from '../components/FormDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { InventoryItem, Supplier, Medication } from '../types';

const units = ['PIECES', 'BOTTLES', 'BOXES', 'VIALS'] as const;

const emptyForm = {
  supplierId: '' as number | '',
  medicationId: '' as number | '',
  name: '',
  quantity: 0,
  unit: 'PIECES' as string,
  reorderLevel: 0,
  unitCost: 0,
  expiryDate: '',
};

export default function InventoryPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<InventoryItem | null>(null);
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [formData, setFormData] = useState(emptyForm);

  const { enqueueSnackbar } = useSnackbar();

  const { useList, useCreate, useUpdate, useDelete } = useCrud<InventoryItem>({
    endpoint: '/inventory',
    queryKey: 'inventory',
  });

  const { data, isLoading } = useList({
    page: String(paginationModel.page + 1),
    pageSize: String(paginationModel.pageSize),
    search,
    ...(supplierFilter !== 'ALL' ? { supplierId: supplierFilter } : {}),
  });

  const { data: suppliersData } = useCrud<Supplier>({
    endpoint: '/suppliers',
    queryKey: 'suppliers-list',
  }).useList({ pageSize: '100' });

  const { data: medsData } = useCrud<Medication>({
    endpoint: '/medications',
    queryKey: 'medications-list',
  }).useList({ pageSize: '100' });

  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const suppliers = suppliersData?.data || [];
  const medications = medsData?.data || [];

  const handleOpen = (item?: InventoryItem) => {
    if (item) {
      setEditItem(item);
      setFormData({
        supplierId: item.supplierId,
        medicationId: item.medicationId || '',
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        reorderLevel: item.reorderLevel,
        unitCost: item.unitCost,
        expiryDate: item.expiryDate ? item.expiryDate.slice(0, 10) : '',
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
      supplierId: Number(formData.supplierId),
      medicationId: formData.medicationId ? Number(formData.medicationId) : null,
      quantity: Number(formData.quantity),
      reorderLevel: Number(formData.reorderLevel),
      unitCost: Number(formData.unitCost),
      expiryDate: formData.expiryDate || null,
    };

    if (editItem) {
      updateMutation.mutate(
        { id: editItem.id, data: payload },
        {
          onSuccess: () => {
            enqueueSnackbar('Inventory item updated successfully', { variant: 'success' });
            handleClose();
          },
          onError: () => enqueueSnackbar('Failed to update inventory item', { variant: 'error' }),
        }
      );
    } else {
      createMutation.mutate(payload as any, {
        onSuccess: () => {
          enqueueSnackbar('Inventory item created successfully', { variant: 'success' });
          handleClose();
        },
        onError: () => enqueueSnackbar('Failed to create inventory item', { variant: 'error' }),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteItem) return;
    deleteMutation.mutate(deleteItem.id, {
      onSuccess: () => {
        enqueueSnackbar('Inventory item deleted successfully', { variant: 'success' });
        setDeleteItem(null);
      },
      onError: () => enqueueSnackbar('Failed to delete inventory item', { variant: 'error' }),
    });
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', flex: 1 },
    {
      field: 'supplierName',
      headerName: 'Supplier',
      flex: 1,
      valueGetter: (_value, row) => row.supplier?.name || '-',
    },
    {
      field: 'quantity',
      headerName: 'Quantity',
      width: 110,
      renderCell: (params) => {
        const isLow = params.row.quantity <= params.row.reorderLevel;
        return (
          <Box sx={{ color: isLow ? 'error.main' : 'inherit', fontWeight: isLow ? 'bold' : 'normal' }}>
            {params.value}
          </Box>
        );
      },
    },
    { field: 'unit', headerName: 'Unit', width: 100 },
    {
      field: 'reorderLevel',
      headerName: 'Reorder Level',
      width: 130,
    },
    {
      field: 'unitCost',
      headerName: 'Unit Cost',
      width: 120,
      valueFormatter: (value) => `$${Number(value).toFixed(2)}`,
    },
    {
      field: 'expiryDate',
      headerName: 'Expiry Date',
      width: 130,
      valueFormatter: (value) => value ? new Date(value).toLocaleDateString() : '-',
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
        title="Inventory"
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Inventory' }]}
        onAdd={() => handleOpen()}
        addLabel="Add Item"
      />

      <Card sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            select
            size="small"
            label="Supplier"
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            sx={{ width: 250 }}
          >
            <MenuItem value="ALL">All Suppliers</MenuItem>
            {suppliers.map((s) => (
              <MenuItem key={s.id} value={String(s.id)}>
                {s.name}
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
          searchPlaceholder="Search inventory..."
        />
      </Card>

      <FormDialog
        open={dialogOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        title={editItem ? 'Edit Inventory Item' : 'Add Inventory Item'}
        loading={createMutation.isPending || updateMutation.isPending}
      >
        <TextField
          select
          label="Supplier"
          required
          value={formData.supplierId}
          onChange={(e) => setFormData({ ...formData, supplierId: Number(e.target.value) })}
        >
          {suppliers.map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Medication (optional)"
          value={formData.medicationId}
          onChange={(e) => setFormData({ ...formData, medicationId: e.target.value ? Number(e.target.value) : '' })}
        >
          <MenuItem value="">None</MenuItem>
          {medications.map((m) => (
            <MenuItem key={m.id} value={m.id}>
              {m.name} ({m.strength})
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <TextField
          label="Quantity"
          type="number"
          required
          value={formData.quantity}
          onChange={(e) => setFormData({ ...formData, quantity: Number(e.target.value) })}
          inputProps={{ min: 0 }}
        />
        <TextField
          select
          label="Unit"
          required
          value={formData.unit}
          onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
        >
          {units.map((u) => (
            <MenuItem key={u} value={u}>{u}</MenuItem>
          ))}
        </TextField>
        <TextField
          label="Reorder Level"
          type="number"
          required
          value={formData.reorderLevel}
          onChange={(e) => setFormData({ ...formData, reorderLevel: Number(e.target.value) })}
          inputProps={{ min: 0 }}
        />
        <TextField
          label="Unit Cost"
          type="number"
          required
          value={formData.unitCost}
          onChange={(e) => setFormData({ ...formData, unitCost: Number(e.target.value) })}
          inputProps={{ min: 0, step: 0.01 }}
        />
        <TextField
          label="Expiry Date"
          type="date"
          value={formData.expiryDate}
          onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
          InputLabelProps={{ shrink: true }}
        />
      </FormDialog>

      <ConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDelete}
        title="Delete Inventory Item"
        message={`Are you sure you want to delete "${deleteItem?.name}"? This action cannot be undone.`}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
