import { useState } from 'react';
import { Card, IconButton, TextField, MenuItem } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { useSnackbar } from 'notistack';
import { Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';
import { useCrud } from '../hooks/useCrud';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import FormDialog from '../components/FormDialog';
import ConfirmDialog from '../components/ConfirmDialog';
import { InsurancePlan } from '../types';

const planTypes = ['HMO', 'PPO', 'EPO', 'POS'];
const coverageLevels = ['BASIC', 'STANDARD', 'PREMIUM'];

const emptyForm = {
  name: '',
  provider: '',
  type: 'HMO',
  coverageLevel: 'STANDARD',
  monthlyPremium: 0,
  deductible: 0,
  maxCoverage: 0,
};

export default function InsurancePlansPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<InsurancePlan | null>(null);
  const [deleteItem, setDeleteItem] = useState<InsurancePlan | null>(null);
  const [search, setSearch] = useState('');
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [formData, setFormData] = useState(emptyForm);

  const { enqueueSnackbar } = useSnackbar();
  const { useList, useCreate, useUpdate, useDelete } = useCrud<InsurancePlan>({
    endpoint: '/insurance-plans',
    queryKey: 'insurance-plans',
  });

  const { data, isLoading } = useList({
    page: String(paginationModel.page + 1),
    pageSize: String(paginationModel.pageSize),
    search,
  });

  const createMutation = useCreate();
  const updateMutation = useUpdate();
  const deleteMutation = useDelete();

  const handleOpen = (item?: InsurancePlan) => {
    if (item) {
      setEditItem(item);
      setFormData({
        name: item.name,
        provider: item.provider,
        type: item.type,
        coverageLevel: item.coverageLevel,
        monthlyPremium: item.monthlyPremium,
        deductible: item.deductible,
        maxCoverage: item.maxCoverage,
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
    const submitData = {
      ...formData,
      monthlyPremium: Number(formData.monthlyPremium),
      deductible: Number(formData.deductible),
      maxCoverage: Number(formData.maxCoverage),
    };
    if (editItem) {
      updateMutation.mutate(
        { id: editItem.id, data: submitData },
        {
          onSuccess: () => {
            enqueueSnackbar('Insurance plan updated successfully', { variant: 'success' });
            handleClose();
          },
          onError: () => enqueueSnackbar('Failed to update insurance plan', { variant: 'error' }),
        }
      );
    } else {
      createMutation.mutate(submitData as any, {
        onSuccess: () => {
          enqueueSnackbar('Insurance plan created successfully', { variant: 'success' });
          handleClose();
        },
        onError: () => enqueueSnackbar('Failed to create insurance plan', { variant: 'error' }),
      });
    }
  };

  const handleDelete = () => {
    if (!deleteItem) return;
    deleteMutation.mutate(deleteItem.id, {
      onSuccess: () => {
        enqueueSnackbar('Insurance plan deleted successfully', { variant: 'success' });
        setDeleteItem(null);
      },
      onError: () => enqueueSnackbar('Failed to delete insurance plan', { variant: 'error' }),
    });
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Plan Name', flex: 1 },
    { field: 'provider', headerName: 'Provider', flex: 1 },
    { field: 'type', headerName: 'Type', width: 100 },
    { field: 'coverageLevel', headerName: 'Coverage Level', width: 140 },
    {
      field: 'monthlyPremium',
      headerName: 'Monthly Premium',
      width: 150,
      valueFormatter: (value: number) => `$${value.toFixed(2)}`,
    },
    {
      field: 'maxCoverage',
      headerName: 'Max Coverage',
      width: 150,
      valueFormatter: (value: number) => `$${value.toLocaleString()}`,
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
        title="Insurance Plans"
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Insurance Plans' }]}
        onAdd={() => handleOpen()}
        addLabel="Add Plan"
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
          searchPlaceholder="Search insurance plans..."
        />
      </Card>

      <FormDialog
        open={dialogOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        title={editItem ? 'Edit Insurance Plan' : 'Add Insurance Plan'}
        loading={createMutation.isPending || updateMutation.isPending}
      >
        <TextField
          label="Plan Name"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
        />
        <TextField
          label="Provider"
          required
          value={formData.provider}
          onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
        />
        <TextField
          label="Type"
          select
          value={formData.type}
          onChange={(e) => setFormData({ ...formData, type: e.target.value })}
        >
          {planTypes.map((t) => (
            <MenuItem key={t} value={t}>{t}</MenuItem>
          ))}
        </TextField>
        <TextField
          label="Coverage Level"
          select
          value={formData.coverageLevel}
          onChange={(e) => setFormData({ ...formData, coverageLevel: e.target.value })}
        >
          {coverageLevels.map((c) => (
            <MenuItem key={c} value={c}>{c}</MenuItem>
          ))}
        </TextField>
        <TextField
          label="Monthly Premium"
          type="number"
          value={formData.monthlyPremium}
          onChange={(e) => setFormData({ ...formData, monthlyPremium: Number(e.target.value) })}
          inputProps={{ min: 0, step: 0.01 }}
        />
        <TextField
          label="Deductible"
          type="number"
          value={formData.deductible}
          onChange={(e) => setFormData({ ...formData, deductible: Number(e.target.value) })}
          inputProps={{ min: 0, step: 0.01 }}
        />
        <TextField
          label="Max Coverage"
          type="number"
          value={formData.maxCoverage}
          onChange={(e) => setFormData({ ...formData, maxCoverage: Number(e.target.value) })}
          inputProps={{ min: 0, step: 1 }}
        />
      </FormDialog>

      <ConfirmDialog
        open={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        onConfirm={handleDelete}
        title="Delete Insurance Plan"
        message={`Are you sure you want to delete "${deleteItem?.name}"? This action cannot be undone.`}
        loading={deleteMutation.isPending}
      />
    </>
  );
}
