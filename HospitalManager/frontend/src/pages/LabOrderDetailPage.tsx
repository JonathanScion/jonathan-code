import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Box, Typography, TextField, Button, Chip, FormControlLabel, Switch } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useCrud } from '../hooks/useCrud';
import PageHeader from '../components/PageHeader';
import DetailPageLayout from '../components/DetailPageLayout';
import NestedTable from '../components/NestedTable';
import FormDialog from '../components/FormDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusStepper from '../components/StatusStepper';
import StatusChip from '../components/StatusChip';
import { LabOrder, LabResult } from '../types';

const emptyResult = {
  parameter: '',
  value: '',
  unit: '',
  normalRange: '',
  isAbnormal: false,
};

export default function LabOrderDetailPage() {
  const { id } = useParams();
  const { enqueueSnackbar } = useSnackbar();

  const [resultDialogOpen, setResultDialogOpen] = useState(false);
  const [editResult, setEditResult] = useState<LabResult | null>(null);
  const [deleteResult, setDeleteResult] = useState<LabResult | null>(null);
  const [resultForm, setResultForm] = useState(emptyResult);

  // Fetch lab order
  const { useGet, useUpdateStatus } = useCrud<LabOrder>({ endpoint: '/lab-orders', queryKey: 'lab-orders' });
  const { data: labOrder, isLoading, isError } = useGet(Number(id));
  const statusMutation = useUpdateStatus();

  // Results CRUD
  const resultCrud = useCrud<LabResult>({ endpoint: '/lab-results', queryKey: 'lab-results' });
  const resultCreate = resultCrud.useCreate();
  const resultUpdate = resultCrud.useUpdate();
  const resultDelete = resultCrud.useDelete();

  // ─── Status handlers ────────────────────────────────────
  const handleStatusChange = (status: string) => {
    statusMutation.mutate(
      { id: Number(id), status },
      {
        onSuccess: () => enqueueSnackbar(`Status updated to ${status.replace(/_/g, ' ')}`, { variant: 'success' }),
        onError: () => enqueueSnackbar('Failed to update status', { variant: 'error' }),
      }
    );
  };

  const renderStatusButtons = () => {
    if (!labOrder) return null;
    const buttons: React.ReactNode[] = [];

    switch (labOrder.status) {
      case 'ORDERED':
        buttons.push(
          <Button key="progress" variant="outlined" color="warning" onClick={() => handleStatusChange('IN_PROGRESS')}>
            Start Processing
          </Button>,
          <Button key="cancel" variant="outlined" color="error" onClick={() => handleStatusChange('CANCELLED')}>
            Cancel
          </Button>
        );
        break;
      case 'IN_PROGRESS':
        buttons.push(
          <Button key="complete" variant="outlined" color="success" onClick={() => handleStatusChange('COMPLETED')}>
            Complete
          </Button>,
          <Button key="cancel" variant="outlined" color="error" onClick={() => handleStatusChange('CANCELLED')}>
            Cancel
          </Button>
        );
        break;
    }

    return buttons.length > 0 ? (
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>{buttons}</Box>
    ) : null;
  };

  // ─── Result handlers ────────────────────────────────────
  const handleResultOpen = (item?: LabResult) => {
    if (item) {
      setEditResult(item);
      setResultForm({
        parameter: item.parameter,
        value: item.value,
        unit: item.unit || '',
        normalRange: item.normalRange || '',
        isAbnormal: item.isAbnormal,
      });
    } else {
      setEditResult(null);
      setResultForm(emptyResult);
    }
    setResultDialogOpen(true);
  };

  const handleResultClose = () => {
    setResultDialogOpen(false);
    setEditResult(null);
    setResultForm(emptyResult);
  };

  const handleResultSubmit = () => {
    const payload = { ...resultForm, labOrderId: Number(id) };
    if (editResult) {
      resultUpdate.mutate(
        { id: editResult.id, data: payload },
        {
          onSuccess: () => { enqueueSnackbar('Result updated', { variant: 'success' }); handleResultClose(); },
          onError: () => enqueueSnackbar('Failed to update result', { variant: 'error' }),
        }
      );
    } else {
      resultCreate.mutate(payload as any, {
        onSuccess: () => { enqueueSnackbar('Result added', { variant: 'success' }); handleResultClose(); },
        onError: () => enqueueSnackbar('Failed to add result', { variant: 'error' }),
      });
    }
  };

  const handleResultDelete = () => {
    if (!deleteResult) return;
    resultDelete.mutate(deleteResult.id, {
      onSuccess: () => { enqueueSnackbar('Result deleted', { variant: 'success' }); setDeleteResult(null); },
      onError: () => enqueueSnackbar('Failed to delete result', { variant: 'error' }),
    });
  };

  // ─── Result columns ─────────────────────────────────────
  const resultColumns = [
    { key: 'parameter', label: 'Parameter' },
    { key: 'value', label: 'Value' },
    { key: 'unit', label: 'Unit' },
    { key: 'normalRange', label: 'Normal Range' },
    {
      key: 'isAbnormal',
      label: 'Abnormal',
      render: (row: LabResult) => (
        <Chip
          label={row.isAbnormal ? 'Abnormal' : 'Normal'}
          color={row.isAbnormal ? 'error' : 'success'}
          size="small"
        />
      ),
    },
  ];

  // ─── Tab content ────────────────────────────────────────
  const overviewContent = labOrder ? (
    <Box>
      <StatusStepper
        steps={['ORDERED', 'IN_PROGRESS', 'COMPLETED']}
        activeStep={labOrder.status}
        isCancelled={labOrder.status === 'CANCELLED'}
      />
      {renderStatusButtons()}
      <Card variant="outlined" sx={{ p: 3, mt: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Test Name</Typography>
            <Typography>{labOrder.testName}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Category</Typography>
            <Typography>{labOrder.category}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Priority</Typography>
            <StatusChip status={labOrder.priority} />
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Status</Typography>
            <StatusChip status={labOrder.status} />
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Ordered At</Typography>
            <Typography>{labOrder.orderedAt ? new Date(labOrder.orderedAt).toLocaleString() : '-'}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Completed At</Typography>
            <Typography>{labOrder.completedAt ? new Date(labOrder.completedAt).toLocaleString() : '-'}</Typography>
          </Box>
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap' }}>{labOrder.notes || '-'}</Typography>
          </Box>
        </Box>
      </Card>
    </Box>
  ) : null;

  const resultsContent = (
    <>
      <NestedTable
        columns={resultColumns}
        rows={labOrder?.results || []}
        onAdd={() => handleResultOpen()}
        onEdit={(row) => handleResultOpen(row)}
        onDelete={(row) => setDeleteResult(row)}
        addLabel="Add Result"
        emptyMessage="No results recorded."
      />
      <FormDialog
        open={resultDialogOpen}
        onClose={handleResultClose}
        onSubmit={handleResultSubmit}
        title={editResult ? 'Edit Result' : 'Add Result'}
        loading={resultCreate.isPending || resultUpdate.isPending}
      >
        <TextField
          label="Parameter"
          required
          value={resultForm.parameter}
          onChange={(e) => setResultForm({ ...resultForm, parameter: e.target.value })}
        />
        <TextField
          label="Value"
          required
          value={resultForm.value}
          onChange={(e) => setResultForm({ ...resultForm, value: e.target.value })}
        />
        <TextField
          label="Unit"
          value={resultForm.unit}
          onChange={(e) => setResultForm({ ...resultForm, unit: e.target.value })}
        />
        <TextField
          label="Normal Range"
          value={resultForm.normalRange}
          onChange={(e) => setResultForm({ ...resultForm, normalRange: e.target.value })}
        />
        <FormControlLabel
          control={
            <Switch
              checked={resultForm.isAbnormal}
              onChange={(e) => setResultForm({ ...resultForm, isAbnormal: e.target.checked })}
            />
          }
          label="Is Abnormal"
        />
      </FormDialog>
      <ConfirmDialog
        open={!!deleteResult}
        onClose={() => setDeleteResult(null)}
        onConfirm={handleResultDelete}
        title="Delete Result"
        message="Are you sure you want to delete this result?"
        loading={resultDelete.isPending}
      />
    </>
  );

  const tabs = [
    { label: 'Overview', content: overviewContent },
    { label: 'Results', content: resultsContent },
  ];

  return (
    <DetailPageLayout
      header={
        <PageHeader
          title={labOrder?.testName || 'Lab Order'}
          breadcrumbs={[
            { label: 'Lab Orders', to: '/lab-orders' },
            { label: labOrder?.testName || `Lab Order #${id}` },
          ]}
        />
      }
      tabs={tabs}
      loading={isLoading}
      error={isError}
    />
  );
}
