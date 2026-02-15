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
import StatusChip from '../components/StatusChip';
import { Room, Bed } from '../types';

const BED_TYPES = ['STANDARD', 'ELECTRIC', 'ICU', 'PEDIATRIC'];
const BED_STATUSES = ['AVAILABLE', 'OCCUPIED', 'RESERVED', 'MAINTENANCE'];

export default function RoomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { enqueueSnackbar } = useSnackbar();

  const { useGet } = useCrud<Room>({ endpoint: '/rooms', queryKey: 'rooms' });
  const { data: room, isLoading, isError } = useGet(Number(id));

  // Beds CRUD
  const {
    useCreate: useCreateBed,
    useUpdate: useUpdateBed,
    useDelete: useDeleteBed,
  } = useCrud<Bed>({ endpoint: '/beds', queryKey: 'beds' });

  const createBedMutation = useCreateBed();
  const updateBedMutation = useUpdateBed();
  const deleteBedMutation = useDeleteBed();

  // Form state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBed, setEditingBed] = useState<Bed | null>(null);
  const [form, setForm] = useState({
    number: '',
    type: 'STANDARD',
    status: 'AVAILABLE',
  });

  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingBed, setDeletingBed] = useState<Bed | null>(null);

  const handleOpen = (bed?: Bed) => {
    if (bed) {
      setEditingBed(bed);
      setForm({
        number: bed.number,
        type: bed.type,
        status: bed.status,
      });
    } else {
      setEditingBed(null);
      setForm({ number: '', type: 'STANDARD', status: 'AVAILABLE' });
    }
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditingBed(null);
  };

  const handleSubmit = async () => {
    try {
      if (editingBed) {
        await updateBedMutation.mutateAsync({
          id: editingBed.id,
          data: { number: form.number, type: form.type, status: form.status },
        });
        enqueueSnackbar('Bed updated', { variant: 'success' });
      } else {
        await createBedMutation.mutateAsync({
          roomId: Number(id),
          number: form.number,
          type: form.type,
          status: form.status,
        } as Partial<Bed>);
        enqueueSnackbar('Bed created', { variant: 'success' });
      }
      handleClose();
    } catch {
      enqueueSnackbar('Failed to save bed', { variant: 'error' });
    }
  };

  const handleDelete = async () => {
    if (!deletingBed) return;
    try {
      await deleteBedMutation.mutateAsync(deletingBed.id);
      enqueueSnackbar('Bed deleted', { variant: 'success' });
      setDeleteDialogOpen(false);
      setDeletingBed(null);
    } catch {
      enqueueSnackbar('Failed to delete bed', { variant: 'error' });
    }
  };

  const bedsTab = (
    <>
      <NestedTable
        columns={[
          { key: 'number', label: 'Bed Number' },
          { key: 'type', label: 'Type' },
          { key: 'status', label: 'Status', render: (row: Bed) =>
            <StatusChip status={row.status} />
          },
        ]}
        rows={room?.beds || []}
        onAdd={() => handleOpen()}
        addLabel="Add Bed"
        onEdit={(row) => handleOpen(row)}
        onDelete={(row) => { setDeletingBed(row); setDeleteDialogOpen(true); }}
        emptyMessage="No beds in this room."
      />

      <FormDialog
        open={dialogOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        title={editingBed ? 'Edit Bed' : 'Add Bed'}
        loading={createBedMutation.isPending || updateBedMutation.isPending}
      >
        <TextField
          fullWidth label="Bed Number" required
          value={form.number}
          onChange={(e) => setForm((prev) => ({ ...prev, number: e.target.value }))}
        />
        <TextField
          fullWidth select label="Type" required
          value={form.type}
          onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
        >
          {BED_TYPES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
        </TextField>
        <TextField
          fullWidth select label="Status" required
          value={form.status}
          onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}
        >
          {BED_STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
      </FormDialog>

      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={() => { setDeleteDialogOpen(false); setDeletingBed(null); }}
        onConfirm={handleDelete}
        loading={deleteBedMutation.isPending}
        message="Are you sure you want to delete this bed?"
      />
    </>
  );

  return (
    <DetailPageLayout
      loading={isLoading}
      error={isError}
      header={
        <PageHeader
          title={room ? `Room ${room.number}` : 'Room'}
          breadcrumbs={[
            { label: 'Rooms', to: '/rooms' },
            { label: room ? room.number : '...' },
          ]}
        />
      }
      tabs={[
        { label: 'Beds', content: bedsTab },
      ]}
    />
  );
}
