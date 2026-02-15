import { DataGrid, GridColDef, GridPaginationModel } from '@mui/x-data-grid';
import { Box, TextField, InputAdornment } from '@mui/material';
import { Search as SearchIcon } from '@mui/icons-material';
import { useState } from 'react';

interface DataTableProps {
  columns: GridColDef[];
  rows: any[];
  total: number;
  loading?: boolean;
  paginationModel: GridPaginationModel;
  onPaginationModelChange: (model: GridPaginationModel) => void;
  onSearch?: (search: string) => void;
  searchPlaceholder?: string;
  onRowClick?: (row: any) => void;
}

export default function DataTable({
  columns,
  rows,
  total,
  loading,
  paginationModel,
  onPaginationModelChange,
  onSearch,
  searchPlaceholder = 'Search...',
  onRowClick,
}: DataTableProps) {
  const [searchValue, setSearchValue] = useState('');

  return (
    <Box>
      {onSearch && (
        <TextField
          size="small"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => {
            setSearchValue(e.target.value);
            onSearch(e.target.value);
          }}
          sx={{ mb: 2, width: 300 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
      )}
      <DataGrid
        rows={rows}
        columns={columns}
        rowCount={total}
        loading={loading}
        pageSizeOptions={[10, 25, 50]}
        paginationModel={paginationModel}
        onPaginationModelChange={onPaginationModelChange}
        paginationMode="server"
        onRowClick={onRowClick ? (params) => onRowClick(params.row) : undefined}
        sx={{
          border: 'none',
          '& .MuiDataGrid-cell': { cursor: onRowClick ? 'pointer' : 'default' },
          '& .MuiDataGrid-columnHeaders': { backgroundColor: 'grey.50' },
          minHeight: 400,
        }}
        disableRowSelectionOnClick
        autoHeight
      />
    </Box>
  );
}
