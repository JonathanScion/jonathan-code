import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusChip from '../../components/StatusChip';

describe('StatusChip', () => {
  it('renders the status label', () => {
    render(<StatusChip status="SCHEDULED" />);
    expect(screen.getByText('SCHEDULED')).toBeInTheDocument();
  });

  it('replaces underscores with spaces', () => {
    render(<StatusChip status="IN_PROGRESS" />);
    expect(screen.getByText('IN PROGRESS')).toBeInTheDocument();
  });

  it('renders with default size small', () => {
    const { container } = render(<StatusChip status="COMPLETED" />);
    const chip = container.querySelector('.MuiChip-sizeSmall');
    expect(chip).toBeInTheDocument();
  });

  it('renders with medium size when specified', () => {
    const { container } = render(<StatusChip status="COMPLETED" size="medium" />);
    const chip = container.querySelector('.MuiChip-sizeMedium');
    expect(chip).toBeInTheDocument();
  });

  it('handles unknown status gracefully', () => {
    render(<StatusChip status="UNKNOWN_STATUS" />);
    expect(screen.getByText('UNKNOWN STATUS')).toBeInTheDocument();
  });
});
