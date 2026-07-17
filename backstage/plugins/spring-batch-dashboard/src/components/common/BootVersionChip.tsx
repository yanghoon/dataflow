import { Chip, Typography } from '@mui/material';

interface BootVersionChipProps {
  bootVersion?: 'Boot3' | 'Boot4' | 'Default' | null;
  size?: 'small' | 'medium';
}

export const BootVersionChip = ({
  bootVersion,
  size = 'small',
}: BootVersionChipProps) => {
  if (!bootVersion) {
    return (
      <Typography variant="body2" color="textSecondary">
        -
      </Typography>
    );
  }

  return (
    <Chip
      label={bootVersion}
      variant="outlined"
      color={bootVersion === 'Boot3' ? 'info' : 'secondary'}
      size={size}
      sx={{ my: 0.5, verticalAlign: 'middle' }}
    />
  );
};
