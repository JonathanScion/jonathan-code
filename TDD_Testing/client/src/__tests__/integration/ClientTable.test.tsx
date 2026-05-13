import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientTable } from '../../components/ClientTable';
import type { Client } from '../../types';

function makeClient(overrides: Partial<Client>): Client {
  return {
    id: 'id-1',
    firstName: 'A',
    lastName: 'A',
    email: 'a@a.com',
    phone: '',
    companyName: '',
    clientType: 'Individual',
    status: 'Active',
    industry: 'Other',
    annualRevenue: null,
    notes: '',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('ClientTable', () => {
  it('renders the empty state when there are no clients', () => {
    render(
      <ClientTable
        clients={[]}
        sortField="lastName"
        sortDirection="asc"
        onSort={() => {}}
        onRowClick={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('renders one row per client', () => {
    const clients = [
      makeClient({ id: '1', firstName: 'Alice', lastName: 'Anderson' }),
      makeClient({ id: '2', firstName: 'Bob', lastName: 'Baker' }),
    ];
    render(
      <ClientTable
        clients={clients}
        sortField="lastName"
        sortDirection="asc"
        onSort={() => {}}
        onRowClick={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByTestId('client-row-1')).toBeInTheDocument();
    expect(screen.getByTestId('client-row-2')).toBeInTheDocument();
  });

  it('invokes onSort with the column field when a sortable header is clicked', async () => {
    const user = userEvent.setup();
    const onSort = vi.fn();
    render(
      <ClientTable
        clients={[makeClient({})]}
        sortField="lastName"
        sortDirection="asc"
        onSort={onSort}
        onRowClick={() => {}}
        onDelete={() => {}}
      />,
    );
    await user.click(screen.getByTestId('sort-status'));
    expect(onSort).toHaveBeenCalledWith('status');
  });

  it('row click fires onRowClick but delete button does not', async () => {
    const user = userEvent.setup();
    const onRowClick = vi.fn();
    const onDelete = vi.fn();
    const c = makeClient({ id: 'x' });
    render(
      <ClientTable
        clients={[c]}
        sortField="lastName"
        sortDirection="asc"
        onSort={() => {}}
        onRowClick={onRowClick}
        onDelete={onDelete}
      />,
    );
    await user.click(screen.getByTestId('delete-x'));
    expect(onDelete).toHaveBeenCalledWith(c);
    expect(onRowClick).not.toHaveBeenCalled();
  });
});
