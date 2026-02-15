import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, TextField, MenuItem } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useCrud } from '../hooks/useCrud';
import PageHeader from '../components/PageHeader';
import DetailPageLayout from '../components/DetailPageLayout';
import NestedTable from '../components/NestedTable';
import FormDialog from '../components/FormDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { Supplier, InventoryItem } from '../types';

const UNITS = ['UNIT', 'BOX', 'PACK', 'BOTTLE', 'VIAL', 'ROLL', 'BAG', 'CASE'];

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { enqueueSnackbar } = useSnackbar();

  const { useGet } = useCrud<Supplier>({ endpoint: '/suppliers', queryKey: 'suppliers' });
  const { data: supplier, isLoading, isError } = useGet(Number(id));

  // Inventory CRUD
  const {
    useList: useInventoryList,
    useCreate: useCreateItem,
    useUpdate: useUpdateItem,
    useDelete: useDeleteItem,
  } = useCrud<InventoryItem>({ endpoint: '/inventory', queryKey: 'inventory' });

  const { data: inventoryData } = useInventoryList({ supplierId: id });
  const createItemMutation = useCreateItem();
  const updateItemMutation = useUpdateItem();
  const deleteItemMutation = useDeleteItem();

  // Form state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState({
    name: '',
    quantity: '',
    unit: 'UNIT',
    reorderLevel: '',
    unitCost: '',
    expiryDate: '',
  });

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<InventoryItem | null>(null);

  const handleOpen = (item?: InventoryItem) => {
    if (item) {
      setEditingItem(item);
      setForm({
        name: item.name,
        quantity: String(item.quantity),
        unit: item.unit,
        reorderLevel: String(item.reorderLevel),
        unitCost: String(item.unitCost),
        expiryDate: item.expiryDate?.split('T')[0] || '',
      });
    } else {
      setEditingItem(null);
      setForm({ name: '', quantity: '', unit: 'UNIT', reorderLevel: '', unitCost: '', expiryDate: '' });
    }
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditingItem(null);
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        name: form.name,
        quantity: Number(form.quantity),
        unit: form.unit,
        reorderLevel: Number(form.reorderLevel),
        unitCost: Number(form.unitCost),
        expiryDate: form.expiryDate || null,
      };

      if (editingItem) {
        await updateItemMutation.mutateAsync({ id: editingItem.id, data: payload });
        enqueueSnackbar('Item updated', { variant: 'success' });
      } else {
        await createItemMutation.mutateAsync({
          ...payload,
          supplierId: Number(id),
        } as Partial<InventoryItem>);
        enqueueSnackbar('Item created', { variant: 'success' });
      }
      handleClose();
    } catch {
      enqueueSnackbar('Failed to save item', { variant: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    try {
      await deleteItemMutation.mutateAsync(deletingItem.id);
      enqueueSnackbar('Item deleted', { variant: 'success' });
      setDeleteDialogOpen(false);
      setDeletingItem(null);
    } catch {
      enqueueSnackbar('Failed to delete item', { variant: 'error' });
    }
  };

  const inventoryRows = inventoryData?.data || [];
  const inventoryTab = (
    <>
      <NestedTable
        columns={[
          { key: 'name', label: 'Name' },
          { key: 'quantity', label: 'Qty' },
          { key: 'unit', label: 'Unit' },
          { key: 'reorderLevel', label: 'Reorder Level' },
          { key: 'unitCost', label: 'Unit Cost', render: (row: InventoryItem) =>
            `$${row.unitCost.toFixed(2)}`
          },
          { key: 'expiryDate', label: 'Expiry Date', render: (row: InventoryItem) =>
            row.expiryDate?.split('T')[0] || '-'
          },
        ]}
        rows={inventoryRows}
        onAdd={() => handleOpen()}
        addLabel="Add Item"
        onEdit={(row) => handleOpen(row)}
        onDelete={(row) => { setDeletingItem(row); setDeleteDialogOpen(true); }}
        emptyMessage="No inventory items."
      />

      <FormDialog
        open={dialogOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        title={editingItem ? 'Edit Item' : 'Add Item'}
        loading={createItemMutation.isPending || updateItemMutation.isPending}
      >
        <TextField
          fullWidth label="Name" required
          value={form.name}
          onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
        />
        <TextField
          fullWidth label="Quantity" type="number" required
          value={form.quantity}
          onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
        />
        <TextField
          fullWidth select label="Unit" required
          value={form.unit}
          onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))}
        >
          {UNITS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
        </TextField>
        <TextField
          fullWidth label="Reorder Level" type="number" required
          value={form.reorderLevel}
          onChange={(e) => setForm((prev) => ({ ...prev, reorderLevel: e.target.value }))}
        />
        <TextField
          fullWidth label="Unit Cost ($)" type="number" required
          value={form.unitCost}
          onChange={(e) => setForm((prev) => ({ ...prev, unitCost: e.target.value }))}
        />
        <TextField
          fullWidth label="Expiry Date" type="date"
          value={form.expiryDate}
          onChange={(e) => setForm((prev) => ({ ...prev, expiryDate: e.target.value }))}
          slotProps={{ inputLabel: { shrink: true } }}
        />
      </FormDialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setDeletingItem(null); }}
        onConfirm={handleDelete}
        loading={deleteItemMutation.isPending}
        message="Are you sure you want to delete this inventory item?"
      />
    </>
  );

  return (
    <DetailPageLayout
      loading={isLoading}
      error={isError}
      header={
        <PageHeader
          title={supplier ? supplier.name : 'Supplier'}
          breadcrumbs={[
            { label: 'Suppliers', to: '/suppliers' },
            { label: supplier?.name || '...' },
          ]}
        />
      }
      tabs={[
        { label: 'Inventory', content: inventoryTab },
      ]}
    />
  );
}
