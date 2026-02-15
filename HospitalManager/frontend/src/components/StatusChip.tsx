import { Chip } from '@mui/material';

const statusColors: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  // Appointments
  SCHEDULED: 'info',
  CONFIRMED: 'primary',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'error',
  // Admissions
  ADMITTED: 'warning',
  DISCHARGED: 'success',
  TRANSFERRED: 'info',
  // Room/Bed status
  AVAILABLE: 'success',
  OCCUPIED: 'warning',
  RESERVED: 'info',
  MAINTENANCE: 'default',
  // Lab orders
  ORDERED: 'info',
  // IN_PROGRESS already defined
  // Bills
  PENDING: 'warning',
  PARTIAL: 'info',
  PAID: 'success',
  OVERDUE: 'error',
  // Prescriptions
  ACTIVE: 'primary',
  // Priority
  STAT: 'error',
  URGENT: 'warning',
  ROUTINE: 'default',
};

interface StatusChipProps {
  status: string;
  size?: 'small' | 'medium';
}

export default function StatusChip({ status, size = 'small' }: StatusChipProps) {
  return (
    <Chip
      label={status.replace(/_/g, ' ')}
      color={statusColors[status] || 'default'}
      size={size}
      variant="filled"
    />
  );
}
