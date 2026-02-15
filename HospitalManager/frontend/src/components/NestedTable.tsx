import {
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  IconButton, Button, Typography, Box, Paper,
} from '@mui/material';
import { Edit as EditIcon, Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';

interface Column {
  key: string;
  label: string;
  render?: (row: any) => React.ReactNode;
}

interface NestedTableProps {
  columns: Column[];
  rows: any[];
  onAdd?: () => void;
  onEdit?: (row: any) => void;
  onDelete?: (row: any) => void;
  onRowClick?: (row: any) => void;
  addLabel?: string;
  emptyMessage?: string;
  title?: string;
}

export default function NestedTable({
  columns, rows, onAdd, onEdit, onDelete, onRowClick,
  addLabel = 'Add', emptyMessage = 'No records found.', title,
}: NestedTableProps) {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        {title && <Typography variant="h6">{title}</Typography>}
        {onAdd && (
          <Button size="small" startIcon={<AddIcon />} onClick={onAdd}>
            {addLabel}
          </Button>
        )}
      </Box>
      {rows.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
          {emptyMessage}
        </Typography>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                {columns.map((col) => (
                  <TableCell key={col.key} sx={{ fontWeight: 600 }}>{col.label}</TableCell>
                ))}
                {(onEdit || onDelete) && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, i) => (
                <TableRow
                  key={row.id || i}
                  hover
                  onClick={() => onRowClick?.(row)}
                  sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
                >
                  {columns.map((col) => (
                    <TableCell key={col.key}>
                      {col.render ? col.render(row) : row[col.key]}
                    </TableCell>
                  ))}
                  {(onEdit || onDelete) && (
                    <TableCell align="right">
                      {onEdit && (
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onEdit(row); }}>
                          <EditIcon fontSize="small" />
                        </IconButton>
                      )}
                      {onDelete && (
                        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(row); }}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
