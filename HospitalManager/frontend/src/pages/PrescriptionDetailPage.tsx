import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Box, Typography, TextField, MenuItem } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useCrud } from '../hooks/useCrud';
import PageHeader from '../components/PageHeader';
import DetailPageLayout from '../components/DetailPageLayout';
import NestedTable from '../components/NestedTable';
import FormDialog from '../components/FormDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusChip from '../components/StatusChip';
import { Prescription, PrescriptionItem, Medication } from '../types';

const emptyItem = {
  medicationId: '' as number | '',
  dosage: '',
  frequency: '',
  duration: '',
  quantity: 1,
  instructions: '',
};

export default function PrescriptionDetailPage() {
  const { id } = useParams();
  const { enqueueSnackbar } = useSnackbar();

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<PrescriptionItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<PrescriptionItem | null>(null);
  const [itemForm, setItemForm] = useState(emptyItem);

  // Fetch prescription
  const { useGet } = useCrud<Prescription>({ endpoint: '/prescriptions', queryKey: 'prescriptions' });
  const { data: prescription, isLoading, isError } = useGet(Number(id));

  // Items CRUD
  const itemCrud = useCrud<PrescriptionItem>({ endpoint: '/prescription-items', queryKey: 'prescription-items' });
  const itemCreate = itemCrud.useCreate();
  const itemUpdate = itemCrud.useUpdate();
  const itemDelete = itemCrud.useDelete();

  // Medications list
  const { data: medsData } = useCrud<Medication>({
    endpoint: '/medications',
    queryKey: 'medications-list',
  }).useList({ pageSize: '100' });
  const medications = medsData?.data || [];

  // ─── Item handlers ──────────────────────────────────────
  const handleItemOpen = (item?: PrescriptionItem) => {
    if (item) {
      setEditItem(item);
      setItemForm({
        medicationId: item.medicationId,
        dosage: item.dosage,
        frequency: item.frequency,
        duration: item.duration,
        quantity: item.quantity,
        instructions: item.instructions || '',
      });
    } else {
      setEditItem(null);
      setItemForm(emptyItem);
    }
    setItemDialogOpen(true);
  };

  const handleItemClose = () => {
    setItemDialogOpen(false);
    setEditItem(null);
    setItemForm(emptyItem);
  };

  const handleItemSubmit = () => {
    const payload = {
      ...itemForm,
      prescriptionId: Number(id),
      medicationId: Number(itemForm.medicationId),
      quantity: Number(itemForm.quantity),
    };
    if (editItem) {
      itemUpdate.mutate(
        { id: editItem.id, data: payload },
        {
          onSuccess: () => { enqueueSnackbar('Item updated', { variant: 'success' }); handleItemClose(); },
          onError: () => enqueueSnackbar('Failed to update item', { variant: 'error' }),
        }
      );
    } else {
      itemCreate.mutate(payload as any, {
        onSuccess: () => { enqueueSnackbar('Item added', { variant: 'success' }); handleItemClose(); },
        onError: () => enqueueSnackbar('Failed to add item', { variant: 'error' }),
      });
    }
  };

  const handleItemDelete = () => {
    if (!deleteItem) return;
    itemDelete.mutate(deleteItem.id, {
      onSuccess: () => { enqueueSnackbar('Item deleted', { variant: 'success' }); setDeleteItem(null); },
      onError: () => enqueueSnackbar('Failed to delete item', { variant: 'error' }),
    });
  };

  // ─── Item columns ───────────────────────────────────────
  const itemColumns = [
    {
      key: 'medicationName',
      label: 'Medication',
      render: (row: PrescriptionItem) => row.medication?.name || '-',
    },
    { key: 'dosage', label: 'Dosage' },
    { key: 'frequency', label: 'Frequency' },
    { key: 'duration', label: 'Duration' },
    { key: 'quantity', label: 'Quantity' },
    { key: 'instructions', label: 'Instructions' },
  ];

  // ─── Tab content ────────────────────────────────────────
  const overviewContent = prescription ? (
    <Card variant="outlined" sx={{ p: 3 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">Doctor</Typography>
          <Typography>
            {prescription.doctor
              ? `Dr. ${prescription.doctor.firstName} ${prescription.doctor.lastName}`
              : '-'}
          </Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">Date</Typography>
          <Typography>{prescription.date ? new Date(prescription.date).toLocaleDateString() : '-'}</Typography>
        </Box>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">Status</Typography>
          <StatusChip status={prescription.status} />
        </Box>
        <Box>
          <Typography variant="subtitle2" color="text.secondary">Items</Typography>
          <Typography>{prescription.items?.length ?? 0}</Typography>
        </Box>
        <Box sx={{ gridColumn: '1 / -1' }}>
          <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
          <Typography sx={{ whiteSpace: 'pre-wrap' }}>{prescription.notes || '-'}</Typography>
        </Box>
      </Box>
    </Card>
  ) : null;

  const itemsContent = (
    <>
      <NestedTable
        columns={itemColumns}
        rows={prescription?.items || []}
        onAdd={() => handleItemOpen()}
        onEdit={(row) => handleItemOpen(row)}
        onDelete={(row) => setDeleteItem(row)}
        addLabel="Add Item"
        emptyMessage="No prescription items."
      />
      <FormDialog
        open={itemDialogOpen}
        onClose={handleItemClose}
        onSubmit={handleItemSubmit}
        title={editItem ? 'Edit Item' : 'Add Item'}
        loading={itemCreate.isPending || itemUpdate.isPending}
      >
        <TextField
          select
          label="Medication"
          required
          value={itemForm.medicationId}
          onChange={(e) => setItemForm({ ...itemForm, medicationId: Number(e.target.value) })}
        >
          {medications.map((m) => (
            <MenuItem key={m.id} value={m.id}>
              {m.name} ({m.strength})
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Dosage"
          required
          value={itemForm.dosage}
          onChange={(e) => setItemForm({ ...itemForm, dosage: e.target.value })}
        />
        <TextField
          label="Frequency"
          required
          value={itemForm.frequency}
          onChange={(e) => setItemForm({ ...itemForm, frequency: e.target.value })}
        />
        <TextField
          label="Duration"
          required
          value={itemForm.duration}
          onChange={(e) => setItemForm({ ...itemForm, duration: e.target.value })}
        />
        <TextField
          label="Quantity"
          type="number"
          required
          value={itemForm.quantity}
          onChange={(e) => setItemForm({ ...itemForm, quantity: Number(e.target.value) })}
          inputProps={{ min: 1 }}
        />
        <TextField
          label="Instructions"
          multiline
          rows={3}
          value={itemForm.instructions}
          onChange={(e) => setItemForm({ ...itemForm, instructions: e.target.value })}
        />
      </FormDialog>
      <ConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleItemDelete}
        title="Delete Item"
        message="Are you sure you want to delete this prescription item?"
        loading={itemDelete.isPending}
      />
    </>
  );

  const tabs = [
    { label: 'Overview', content: overviewContent },
    { label: 'Items', content: itemsContent },
  ];

  return (
    <DetailPageLayout
      header={
        <PageHeader
          title={`Prescription #${id}`}
          breadcrumbs={[
            { label: 'Visits', to: '/visits' },
            { label: `Prescription #${id}` },
          ]}
        />
      }
      tabs={tabs}
      loading={isLoading}
      error={isError}
    />
  );
}
