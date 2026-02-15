import { useState } from 'react';
import { Box, TextField, MenuItem } from '@mui/material';
import Grid2 from '@mui/material/Grid2';
import { GridColDef, GridPaginationModel } from '@mui/x-data-grid';
import { useSnackbar } from 'notistack';
import { useCrud } from '../hooks/useCrud';
import PageHeader from '../components/PageHeader';
import DataTable from '../components/DataTable';
import FormDialog from '../components/FormDialog';
import { Staff, Department } from '../types';

const ROLES = ['NURSE', 'TECHNICIAN', 'RECEPTIONIST', 'ADMIN', 'JANITOR'];

const emptyForm = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  role: '',
  departmentId: '',
  salary: '',
};

export default function StaffPage() {
  const { enqueueSnackbar } = useSnackbar();
  const { useList, useCreate, useUpdate } = useCrud<Staff>({ endpoint: '/staff', queryKey: 'staff' });

  // Fetch departments for filter and form
  const { useList: useDeptList } = useCrud<Department>({ endpoint: '/departments', queryKey: 'departments' });
  const { data: deptsData } = useDeptList({ pageSize: 100 });
  const departments = deptsData?.data || [];

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 10 });
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data, isLoading } = useList({
    page: paginationModel.page + 1,
    pageSize: paginationModel.pageSize,
    search: search || undefined,
    departmentId: departmentFilter || undefined,
  });

  const createMutation = useCreate();
  const updateMutation = useUpdate();

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      valueGetter: (_value, row) => `${row.firstName} ${row.lastName}`,
    },
    { field: 'email', headerName: 'Email', flex: 1 },
    { field: 'role', headerName: 'Role', width: 130 },
    {
      field: 'departmentName',
      headerName: 'Department',
      width: 160,
      valueGetter: (_value, row) => row.department?.name || '-',
    },
    { field: 'hireDate', headerName: 'Hire Date', width: 120,
      valueGetter: (_value, row) => row.hireDate?.split('T')[0],
    },
    {
      field: 'salary',
      headerName: 'Salary',
      width: 120,
      valueFormatter: (value: number) => `$${value?.toLocaleString() ?? '0'}`,
    },
  ];

  const handleOpen = (staff?: Staff) => {
    if (staff) {
      setEditingStaff(staff);
      setForm({
        firstName: staff.firstName,
        lastName: staff.lastName,
        email: staff.email,
        phone: staff.phone || '',
        role: staff.role,
        departmentId: String(staff.departmentId),
        salary: String(staff.salary),
      });
    } else {
      setEditingStaff(null);
      setForm(emptyForm);
    }
    setDialogOpen(true);
  };

  const handleClose = () => {
    setDialogOpen(false);
    setEditingStaff(null);
  };

  const handleSubmit = async () => {
    try {
      const payload = {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone || null,
        role: form.role,
        departmentId: Number(form.departmentId),
        salary: Number(form.salary),
      };

      if (editingStaff) {
        await updateMutation.mutateAsync({ id: editingStaff.id, data: payload });
        enqueueSnackbar('Staff member updated', { variant: 'success' });
      } else {
        await createMutation.mutateAsync(payload as Partial<Staff>);
        enqueueSnackbar('Staff member created', { variant: 'success' });
      }
      handleClose();
    } catch {
      enqueueSnackbar('Failed to save staff member', { variant: 'error' });
    }
  };

  const updateField = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <Box>
      <PageHeader title="Staff" onAdd={() => handleOpen()} addLabel="Add Staff" />

      <Box sx={{ mb: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
        <TextField
          select
          size="small"
          label="Department"
          value={departmentFilter}
          onChange={(e) => {
            setDepartmentFilter(e.target.value);
            setPaginationModel((prev) => ({ ...prev, page: 0 }));
          }}
          sx={{ width: 220 }}
        >
          <MenuItem value="">All Departments</MenuItem>
          {departments.map((dept) => (
            <MenuItem key={dept.id} value={String(dept.id)}>{dept.name}</MenuItem>
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
        searchPlaceholder="Search by name..."
      />

      <FormDialog
        open={dialogOpen}
        onClose={handleClose}
        onSubmit={handleSubmit}
        title={editingStaff ? 'Edit Staff Member' : 'Add Staff Member'}
        loading={createMutation.isPending || updateMutation.isPending}
      >
        <Grid2 container spacing={2}>
          <Grid2 size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="First Name" required value={form.firstName}
              onChange={(e) => updateField('firstName', e.target.value)} />
          </Grid2>
          <Grid2 size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Last Name" required value={form.lastName}
              onChange={(e) => updateField('lastName', e.target.value)} />
          </Grid2>
          <Grid2 size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Email" type="email" required value={form.email}
              onChange={(e) => updateField('email', e.target.value)} />
          </Grid2>
          <Grid2 size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Phone" value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)} />
          </Grid2>
          <Grid2 size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth select label="Role" required value={form.role}
              onChange={(e) => updateField('role', e.target.value)}>
              {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </TextField>
          </Grid2>
          <Grid2 size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth select label="Department" required value={form.departmentId}
              onChange={(e) => updateField('departmentId', e.target.value)}>
              {departments.map((dept) => (
                <MenuItem key={dept.id} value={String(dept.id)}>{dept.name}</MenuItem>
              ))}
            </TextField>
          </Grid2>
          <Grid2 size={{ xs: 12, sm: 6 }}>
            <TextField fullWidth label="Salary ($)" type="number" required value={form.salary}
              onChange={(e) => updateField('salary', e.target.value)} />
          </Grid2>
        </Grid2>
      </FormDialog>
    </Box>
  );
}
