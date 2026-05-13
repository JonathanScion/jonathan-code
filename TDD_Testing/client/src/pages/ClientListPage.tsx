import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteClient } from '../api/client';
import { ClientTable, type SortDirection, type SortField } from '../components/ClientTable';
import { SearchBar } from '../components/SearchBar';
import { useClients } from '../hooks/useClients';
import type { Client } from '../types';

export function ClientListPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('lastName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const params = useMemo(
    () => ({ q: query, sort: sortField, dir: sortDirection }),
    [query, sortField, sortDirection],
  );

  const { clients, loading, error, refresh } = useClients(params);

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleDelete = async (client: Client) => {
    await deleteClient(client.id);
    await refresh();
  };

  return (
    <div data-testid="page-list">
      <div className="toolbar">
        <div className="grow">
          <SearchBar value={query} onChange={setQuery} placeholder="Search by name, email, company…" />
        </div>
        <button
          className="primary"
          onClick={() => navigate('/new')}
          data-testid="new-client"
        >
          New client
        </button>
      </div>

      {error && (
        <div className="error-banner" data-testid="list-error">
          {error}
        </div>
      )}
      {loading ? (
        <div className="loading" data-testid="list-loading">Loading clients…</div>
      ) : (
        <ClientTable
          clients={clients}
          sortField={sortField}
          sortDirection={sortDirection}
          onSort={handleSort}
          onRowClick={(c) => navigate(`/${c.id}`)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}
