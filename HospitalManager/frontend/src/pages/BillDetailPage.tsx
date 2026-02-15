import { useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card, Box, Typography, TextField, MenuItem, Button,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useCrud } from '../hooks/useCrud';
import api from '../utils/api';
import PageHeader from '../components/PageHeader';
import DetailPageLayout from '../components/DetailPageLayout';
import NestedTable from '../components/NestedTable';
import FormDialog from '../components/FormDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import StatusStepper from '../components/StatusStepper';
import StatusChip from '../components/StatusChip';
import { Bill, BillLineItem } from '../types';

const lineItemCategories = ['CONSULTATION', 'PROCEDURE', 'MEDICATION', 'LAB', 'ROOM', 'OTHER'] as const;

const emptyLineItem = {
  description: '',
  category: 'CONSULTATION' as string,
  quantity: 1,
  unitPrice: 0,
};

export default function BillDetailPage() {
  const { id } = useParams();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();

  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<BillLineItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<BillLineItem | null>(null);
  const [itemForm, setItemForm] = useState(emptyLineItem);
  const [recalculating, setRecalculating] = useState(false);

  // Fetch bill
  const { useGet, useUpdateStatus } = useCrud<Bill>({ endpoint: '/bills', queryKey: 'bills' });
  const { data: bill, isLoading, isError } = useGet(Number(id));
  const statusMutation = useUpdateStatus();

  // Line items CRUD
  const liCrud = useCrud<BillLineItem>({ endpoint: '/bill-line-items', queryKey: 'bill-line-items' });
  const liCreate = liCrud.useCreate();
  const liUpdate = liCrud.useUpdate();
  const liDelete = liCrud.useDelete();

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
    if (!bill) return null;
    const buttons: React.ReactNode[] = [];

    switch (bill.status) {
      case 'PENDING':
        buttons.push(
          <Button key="partial" variant="outlined" color="info" onClick={() => handleStatusChange('PARTIAL')}>
            Mark Partial
          </Button>,
          <Button key="paid" variant="outlined" color="success" onClick={() => handleStatusChange('PAID')}>
            Mark Paid
          </Button>,
          <Button key="overdue" variant="outlined" color="error" onClick={() => handleStatusChange('OVERDUE')}>
            Mark Overdue
          </Button>,
          <Button key="cancel" variant="outlined" color="error" onClick={() => handleStatusChange('CANCELLED')}>
            Cancel
          </Button>
        );
        break;
      case 'PARTIAL':
        buttons.push(
          <Button key="paid" variant="outlined" color="success" onClick={() => handleStatusChange('PAID')}>
            Mark Paid
          </Button>,
          <Button key="overdue" variant="outlined" color="error" onClick={() => handleStatusChange('OVERDUE')}>
            Mark Overdue
          </Button>
        );
        break;
      case 'OVERDUE':
        buttons.push(
          <Button key="partial" variant="outlined" color="info" onClick={() => handleStatusChange('PARTIAL')}>
            Mark Partial
          </Button>,
          <Button key="paid" variant="outlined" color="success" onClick={() => handleStatusChange('PAID')}>
            Mark Paid
          </Button>
        );
        break;
    }

    return buttons.length > 0 ? (
      <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>{buttons}</Box>
    ) : null;
  };

  // ─── Recalculate total ──────────────────────────────────
  const handleRecalculate = async () => {
    setRecalculating(true);
    try {
      await api.post(`/bills/${id}/recalculate`);
      queryClient.invalidateQueries({ queryKey: ['bills'] });
      enqueueSnackbar('Total recalculated', { variant: 'success' });
    } catch {
      enqueueSnackbar('Failed to recalculate total', { variant: 'error' });
    } finally {
      setRecalculating(false);
    }
  };

  // ─── Line item handlers ─────────────────────────────────
  const handleItemOpen = (item?: BillLineItem) => {
    if (item) {
      setEditItem(item);
      setItemForm({
        description: item.description,
        category: item.category,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      });
    } else {
      setEditItem(null);
      setItemForm(emptyLineItem);
    }
    setItemDialogOpen(true);
  };

  const handleItemClose = () => {
    setItemDialogOpen(false);
    setEditItem(null);
    setItemForm(emptyLineItem);
  };

  const handleItemSubmit = () => {
    const payload = {
      ...itemForm,
      billId: Number(id),
      quantity: Number(itemForm.quantity),
      unitPrice: Number(itemForm.unitPrice),
    };
    if (editItem) {
      liUpdate.mutate(
        { id: editItem.id, data: payload },
        {
          onSuccess: () => { enqueueSnackbar('Line item updated', { variant: 'success' }); handleItemClose(); },
          onError: () => enqueueSnackbar('Failed to update line item', { variant: 'error' }),
        }
      );
    } else {
      liCreate.mutate(payload as any, {
        onSuccess: () => { enqueueSnackbar('Line item added', { variant: 'success' }); handleItemClose(); },
        onError: () => enqueueSnackbar('Failed to add line item', { variant: 'error' }),
      });
    }
  };

  const handleItemDelete = () => {
    if (!deleteItem) return;
    liDelete.mutate(deleteItem.id, {
      onSuccess: () => { enqueueSnackbar('Line item deleted', { variant: 'success' }); setDeleteItem(null); },
      onError: () => enqueueSnackbar('Failed to delete line item', { variant: 'error' }),
    });
  };

  // ─── Line item columns ──────────────────────────────────
  const lineItemColumns = [
    { key: 'description', label: 'Description' },
    { key: 'category', label: 'Category' },
    { key: 'quantity', label: 'Quantity' },
    {
      key: 'unitPrice',
      label: 'Unit Price',
      render: (row: BillLineItem) => `$${Number(row.unitPrice).toFixed(2)}`,
    },
    {
      key: 'total',
      label: 'Total',
      render: (row: BillLineItem) => `$${Number(row.total).toFixed(2)}`,
    },
  ];

  // Compute footer total from line items
  const lineItemsTotal = (bill?.lineItems || []).reduce((sum, li) => sum + Number(li.total), 0);

  // ─── Tab content ────────────────────────────────────────
  const overviewContent = bill ? (
    <Box>
      <StatusStepper
        steps={['PENDING', 'PARTIAL', 'PAID']}
        activeStep={bill.status}
        isCancelled={bill.status === 'CANCELLED'}
      />
      {renderStatusButtons()}
      <Card variant="outlined" sx={{ p: 3, mt: 2 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Patient</Typography>
            <Typography>
              {bill.patient ? `${bill.patient.firstName} ${bill.patient.lastName}` : '-'}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Status</Typography>
            <StatusChip status={bill.status} />
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Date</Typography>
            <Typography>{bill.date ? new Date(bill.date).toLocaleDateString() : '-'}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Due Date</Typography>
            <Typography>{bill.dueDate ? new Date(bill.dueDate).toLocaleDateString() : '-'}</Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Total Amount</Typography>
            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
              ${Number(bill.totalAmount).toFixed(2)}
            </Typography>
          </Box>
          <Box>
            <Typography variant="subtitle2" color="text.secondary">Paid Amount</Typography>
            <Typography>${Number(bill.paidAmount).toFixed(2)}</Typography>
          </Box>
          <Box sx={{ gridColumn: '1 / -1' }}>
            <Typography variant="subtitle2" color="text.secondary">Notes</Typography>
            <Typography sx={{ whiteSpace: 'pre-wrap' }}>{bill.notes || '-'}</Typography>
          </Box>
        </Box>
      </Card>
    </Box>
  ) : null;

  const lineItemsContent = (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        <Button
          variant="outlined"
          onClick={handleRecalculate}
          disabled={recalculating}
        >
          {recalculating ? 'Recalculating...' : 'Recalculate Total'}
        </Button>
      </Box>
      <NestedTable
        columns={lineItemColumns}
        rows={bill?.lineItems || []}
        onAdd={() => handleItemOpen()}
        onEdit={(row) => handleItemOpen(row)}
        onDelete={(row) => setDeleteItem(row)}
        addLabel="Add Line Item"
        emptyMessage="No line items."
      />
      {(bill?.lineItems || []).length > 0 && (
        <TableContainer component={Paper} variant="outlined" sx={{ mt: 1 }}>
          <Table size="small">
            <TableBody>
              <TableRow>
                <TableCell colSpan={4} align="right" sx={{ fontWeight: 'bold' }}>
                  Total
                </TableCell>
                <TableCell sx={{ fontWeight: 'bold' }}>
                  ${lineItemsTotal.toFixed(2)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableBody>
          </Table>
        </TableContainer>
      )}
      <FormDialog
        open={itemDialogOpen}
        onClose={handleItemClose}
        onSubmit={handleItemSubmit}
        title={editItem ? 'Edit Line Item' : 'Add Line Item'}
        loading={liCreate.isPending || liUpdate.isPending}
      >
        <TextField
          label="Description"
          required
          value={itemForm.description}
          onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
        />
        <TextField
          select
          label="Category"
          required
          value={itemForm.category}
          onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })}
        >
          {lineItemCategories.map((c) => (
            <MenuItem key={c} value={c}>{c}</MenuItem>
          ))}
        </TextField>
        <TextField
          label="Quantity"
          type="number"
          required
          value={itemForm.quantity}
          onChange={(e) => setItemForm({ ...itemForm, quantity: Number(e.target.value) })}
          inputProps={{ min: 1 }}
        />
        <TextField
          label="Unit Price"
          type="number"
          required
          value={itemForm.unitPrice}
          onChange={(e) => setItemForm({ ...itemForm, unitPrice: Number(e.target.value) })}
          inputProps={{ min: 0, step: 0.01 }}
        />
        <Box>
          <Typography variant="body2" color="text.secondary">
            Computed Total: ${(Number(itemForm.quantity) * Number(itemForm.unitPrice)).toFixed(2)}
          </Typography>
        </Box>
      </FormDialog>
      <ConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleItemDelete}
        title="Delete Line Item"
        message="Are you sure you want to delete this line item?"
        loading={liDelete.isPending}
      />
    </>
  );

  const tabs = [
    { label: 'Overview', content: overviewContent },
    { label: 'Line Items', content: lineItemsContent },
  ];

  return (
    <DetailPageLayout
      header={
        <PageHeader
          title={`Bill #${id}`}
          breadcrumbs={[
            { label: 'Bills', to: '/bills' },
            { label: `Bill #${id}` },
          ]}
        />
      }
      tabs={tabs}
      loading={isLoading}
      error={isError}
    />
  );
}
