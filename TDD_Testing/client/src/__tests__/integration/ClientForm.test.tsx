import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ClientForm } from '../../components/ClientForm';
import type { ClientInput, Lookups } from '../../types';

const lookups: Lookups = {
  clientTypes: ['Individual', 'Business', 'Enterprise', 'Non-profit'],
  statuses: ['Active', 'Inactive', 'Prospect'],
  industries: ['Technology', 'Healthcare', 'Finance', 'Retail', 'Manufacturing', 'Education', 'Other'],
};

const blank: ClientInput = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  companyName: '',
  clientType: 'Individual',
  status: 'Prospect',
  industry: 'Other',
  annualRevenue: null,
  notes: '',
};

describe('ClientForm', () => {
  it('shows required-field errors on submit', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ClientForm
        initial={blank}
        lookups={lookups}
        submitting={false}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    );

    await user.click(screen.getByTestId('form-submit'));

    expect(screen.getByTestId('error-firstName')).toBeInTheDocument();
    expect(screen.getByTestId('error-lastName')).toBeInTheDocument();
    expect(screen.getByTestId('error-email')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('reveals the revenue field only when clientType is Business or Enterprise', async () => {
    const user = userEvent.setup();
    render(
      <ClientForm
        initial={blank}
        lookups={lookups}
        submitting={false}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );

    expect(screen.queryByTestId('input-annualRevenue')).not.toBeInTheDocument();
    await user.selectOptions(screen.getByTestId('select-clientType'), 'Business');
    expect(screen.getByTestId('input-annualRevenue')).toBeInTheDocument();

    await user.selectOptions(screen.getByTestId('select-clientType'), 'Individual');
    expect(screen.queryByTestId('input-annualRevenue')).not.toBeInTheDocument();
  });

  it('submits the full input when the form is valid', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(
      <ClientForm
        initial={blank}
        lookups={lookups}
        submitting={false}
        onSubmit={onSubmit}
        onCancel={() => {}}
      />,
    );

    await user.type(screen.getByTestId('input-firstName'), 'New');
    await user.type(screen.getByTestId('input-lastName'), 'Person');
    await user.type(screen.getByTestId('input-email'), 'new@example.com');
    await user.type(screen.getByTestId('input-phone'), '+1-555-0100');
    await user.selectOptions(screen.getByTestId('select-status'), 'Active');
    await user.click(screen.getByTestId('form-submit'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toMatchObject({
      firstName: 'New',
      lastName: 'Person',
      email: 'new@example.com',
      status: 'Active',
    });
  });
});
