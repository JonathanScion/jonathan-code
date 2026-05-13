import type { Client } from '../types';
import { formatCurrency, formatFullName } from '../utils/format';

export type SortField = 'lastName' | 'createdAt' | 'annualRevenue' | 'status';
export type SortDirection = 'asc' | 'desc';

interface Props {
  clients: Client[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onRowClick: (client: Client) => void;
  onDelete: (client: Client) => void;
}

interface ColumnDef {
  field: SortField | null;
  label: string;
}

const COLUMNS: ColumnDef[] = [
  { field: 'lastName', label: 'Name' },
  { field: null, label: 'Email' },
  { field: null, label: 'Company' },
  { field: null, label: 'Type' },
  { field: 'status', label: 'Status' },
  { field: 'annualRevenue', label: 'Revenue' },
  { field: null, label: '' },
];

export function ClientTable({
  clients,
  sortField,
  sortDirection,
  onSort,
  onRowClick,
  onDelete,
}: Props) {
  if (clients.length === 0) {
    return (
      <div className="empty" data-testid="empty-state">
        No clients yet. Create one to get started.
      </div>
    );
  }

  return (
    <table data-testid="clients-table">
      <thead>
        <tr>
          {COLUMNS.map((col) => {
            const isActive = col.field && col.field === sortField;
            const arrow = isActive ? (sortDirection === 'asc' ? ' ▲' : ' ▼') : '';
            return (
              <th
                key={col.label}
                className={col.field ? 'sortable' : ''}
                onClick={() => col.field && onSort(col.field)}
                data-testid={col.field ? `sort-${col.field}` : undefined}
              >
                {col.label}
                {arrow}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {clients.map((c) => (
          <tr
            key={c.id}
            className="client-row"
            onClick={() => onRowClick(c)}
            data-testid={`client-row-${c.id}`}
          >
            <td data-testid="cell-name">{formatFullName(c)}</td>
            <td>{c.email}</td>
            <td>{c.companyName || '—'}</td>
            <td>{c.clientType}</td>
            <td>
              <span className={`status-pill ${c.status}`}>{c.status}</span>
            </td>
            <td>{formatCurrency(c.annualRevenue)}</td>
            <td onClick={(e) => e.stopPropagation()}>
              <button
                className="danger"
                onClick={() => onDelete(c)}
                data-testid={`delete-${c.id}`}
                aria-label={`Delete ${formatFullName(c)}`}
              >
                Delete
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
