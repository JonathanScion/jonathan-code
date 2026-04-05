import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DataTable from '../../components/DataTable';

describe('DataTable', () => {
  const defaultProps = {
    columns: [
      { field: 'name', headerName: 'Name', flex: 1 },
      { field: 'value', headerName: 'Value', flex: 1 },
    ],
    rows: [
      { id: 1, name: 'Item 1', value: 'Val 1' },
      { id: 2, name: 'Item 2', value: 'Val 2' },
    ],
    total: 2,
    paginationModel: { page: 0, pageSize: 25 },
    onPaginationModelChange: vi.fn(),
  };

  it('renders column headers', () => {
    render(<DataTable {...defaultProps} />);
    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('Value')).toBeInTheDocument();
  });

  it('renders row data', () => {
    render(<DataTable {...defaultProps} />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });

  it('renders search input when onSearch is provided', () => {
    render(<DataTable {...defaultProps} onSearch={vi.fn()} />);
    expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
  });

  it('does not render search input when onSearch is not provided', () => {
    render(<DataTable {...defaultProps} />);
    expect(screen.queryByPlaceholderText('Search...')).not.toBeInTheDocument();
  });

  it('uses custom search placeholder', () => {
    render(<DataTable {...defaultProps} onSearch={vi.fn()} searchPlaceholder="Find items..." />);
    expect(screen.getByPlaceholderText('Find items...')).toBeInTheDocument();
  });

  it('calls onSearch when typing in search', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<DataTable {...defaultProps} onSearch={onSearch} />);
    const searchInput = screen.getByPlaceholderText('Search...');
    await user.type(searchInput, 'test');
    expect(onSearch).toHaveBeenCalled();
  });
});
