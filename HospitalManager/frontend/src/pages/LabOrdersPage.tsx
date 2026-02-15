import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Box, TextField, MenuItem } from '@mui/material';
import { GridColDef } from '@mui/x-data-grid';
import { useCrud } from '../hooks/useCrud';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import StatusChip from '../components/StatusChip';
import { LabOrder } from '../types';

const STATUSES = ['ALL', 'ORDERED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] as const;

export default function LabOrdersPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });

  const navigate = useNavigate();

  const { useList } = useCrud<LabOrder>({
    endpoint: '/lab-orders',
    queryKey: 'lab-orders',
  });

  const { data, isLoading } = useList({
    page: String(paginationModel.page + 1),
    pageSize: String(paginationModel.pageSize),
    search,
    ...(statusFilter !== 'ALL' ? { status: statusFilter } : {}),
  });

  const columns: GridColDef[] = [
    { field: 'testName', headerName: 'Test Name', flex: 1 },
    { field: 'category', headerName: 'Category', width: 130 },
    {
      field: 'priority',
      headerName: 'Priority',
      width: 120,
      renderCell: (params) => <StatusChip status={params.value} />,
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 140,
      renderCell: (params) => <StatusChip status={params.value} />,
    },
    {
      field: 'orderedAt',
      headerName: 'Ordered At',
      flex: 1,
      valueFormatter: (value) => value ? new Date(value).toLocaleDateString() : '',
    },
  ];

  return (
    <>
      <PageHeader
        title="Lab Orders"
        breadcrumbs={[{ label: 'Dashboard', to: '/' }, { label: 'Lab Orders' }]}
      />

      <Card sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
          <TextField
            select
            size="small"
            label="Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            sx={{ width: 200 }}
          >
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {s === 'ALL' ? 'All Statuses' : s.replace(/_/g, ' ')}
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
          searchPlaceholder="Search lab orders..."
          onRowClick={(row) => navigate(`/lab-orders/${row.id}`)}
        />
      </Card>
    </>
  );
}
