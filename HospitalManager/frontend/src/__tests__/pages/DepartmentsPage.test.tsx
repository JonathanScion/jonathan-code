import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import DepartmentsPage from '../../pages/DepartmentsPage';
import { renderWithProviders } from '../test-utils';

describe('DepartmentsPage', () => {
  it('renders page header', async () => {
    renderWithProviders(<DepartmentsPage />);
    const headings = screen.getAllByText('Departments');
    expect(headings.length).toBeGreaterThanOrEqual(1);
  });

  it('renders Add Department button', () => {
    renderWithProviders(<DepartmentsPage />);
    expect(screen.getByText('Add Department')).toBeInTheDocument();
  });

  it('displays departments from API', async () => {
    renderWithProviders(<DepartmentsPage />);
    await waitFor(() => {
      expect(screen.getByText('Cardiology')).toBeInTheDocument();
    });
    expect(screen.getByText('Neurology')).toBeInTheDocument();
  });

  it('opens create dialog when Add Department is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DepartmentsPage />);
    await user.click(screen.getByText('Add Department'));
    expect(screen.getByText('Add Department', { selector: 'h2' })).toBeInTheDocument();
  });

  it('shows search input', () => {
    renderWithProviders(<DepartmentsPage />);
    expect(screen.getByPlaceholderText('Search departments...')).toBeInTheDocument();
  });
});
