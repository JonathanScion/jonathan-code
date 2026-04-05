import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FormDialog from '../../components/FormDialog';

describe('FormDialog', () => {
  const defaultProps = {
    open: true,
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    title: 'Test Dialog',
    children: <input data-testid="test-input" />,
  };

  it('renders title and children when open', () => {
    render(<FormDialog {...defaultProps} />);
    expect(screen.getByText('Test Dialog')).toBeInTheDocument();
    expect(screen.getByTestId('test-input')).toBeInTheDocument();
  });

  it('does not render content when closed', () => {
    render(<FormDialog {...defaultProps} open={false} />);
    expect(screen.queryByText('Test Dialog')).not.toBeInTheDocument();
  });

  it('calls onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    render(<FormDialog {...defaultProps} />);
    await user.click(screen.getByText('Cancel'));
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('calls onSubmit when Save is clicked', async () => {
    const user = userEvent.setup();
    render(<FormDialog {...defaultProps} />);
    await user.click(screen.getByText('Save'));
    expect(defaultProps.onSubmit).toHaveBeenCalled();
  });

  it('shows custom submit label', () => {
    render(<FormDialog {...defaultProps} submitLabel="Create" />);
    expect(screen.getByText('Create')).toBeInTheDocument();
  });

  it('shows Saving... when loading', () => {
    render(<FormDialog {...defaultProps} loading={true} />);
    expect(screen.getByText('Saving...')).toBeInTheDocument();
  });

  it('disables submit button when loading', () => {
    render(<FormDialog {...defaultProps} loading={true} />);
    expect(screen.getByText('Saving...')).toBeDisabled();
  });

  it('calls onClose when X button is clicked', async () => {
    const user = userEvent.setup();
    render(<FormDialog {...defaultProps} />);
    const closeBtn = screen.getByTestId('CloseIcon').closest('button');
    if (closeBtn) await user.click(closeBtn);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
