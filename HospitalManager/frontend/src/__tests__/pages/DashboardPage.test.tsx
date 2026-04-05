import { describe, it, expect } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import DashboardPage from '../../pages/DashboardPage';
import { renderWithProviders } from '../test-utils';

describe('DashboardPage', () => {
  it('renders loading spinner initially', () => {
    renderWithProviders(<DashboardPage />);
    expect(document.querySelector('.MuiCircularProgress-root')).toBeInTheDocument();
  });

  it('renders dashboard title after loading', async () => {
    renderWithProviders(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Dashboard')).toBeInTheDocument();
    });
  });

  it('displays stat cards with correct titles', async () => {
    renderWithProviders(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('Total Patients')).toBeInTheDocument();
    });
    expect(screen.getByText("Today's Appointments")).toBeInTheDocument();
    expect(screen.getByText('Bed Occupancy')).toBeInTheDocument();
    expect(screen.getByText('Pending Lab Orders')).toBeInTheDocument();
    expect(screen.getByText('Outstanding Bills')).toBeInTheDocument();
  });

  it('displays stat values from API', async () => {
    renderWithProviders(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('150')).toBeInTheDocument();
    });
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('45/100')).toBeInTheDocument();
    expect(screen.getByText('8')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
  });

  it('displays bed occupancy percentage', async () => {
    renderWithProviders(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('45% occupied')).toBeInTheDocument();
    });
  });

  it('displays outstanding bills total', async () => {
    renderWithProviders(<DashboardPage />);
    await waitFor(() => {
      expect(screen.getByText('$15000.00 total')).toBeInTheDocument();
    });
  });
});
