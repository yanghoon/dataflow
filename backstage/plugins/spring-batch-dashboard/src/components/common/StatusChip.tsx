import { Chip, Typography } from '@mui/material';
import type { JobStatus } from '../../types';

interface StatusChipProps {
  status?: JobStatus | null;
  size?: 'small' | 'medium';
  minWidth?: number;
}

type ChipColor =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'error'
  | 'info'
  | 'success'
  | 'warning';

const statusToColor = (status: JobStatus): ChipColor => {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'FAILED':
      return 'error';
    case 'STARTED':
      return 'info';
    default:
      return 'default';
  }
};

export const StatusChip = ({
  status,
  size = 'small',
  minWidth = 80,
}: StatusChipProps) => {
  if (!status) {
    return (
      <Typography variant="body2" color="textSecondary">
        -
      </Typography>
    );
  }

  return (
    <Chip
      label={status}
      variant="outlined"
      color={statusToColor(status)}
      size={size}
      sx={{ minWidth, my: 0.5, verticalAlign: 'middle' }}
    />
  );
};
