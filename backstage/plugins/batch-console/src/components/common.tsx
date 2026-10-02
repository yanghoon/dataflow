import Chip from '@material-ui/core/Chip';
import Typography from '@material-ui/core/Typography';
import Box from '@material-ui/core/Box';
import Grid from '@material-ui/core/Grid';
import { useTheme } from '@material-ui/core/styles';
import yaml from 'yaml';

export const formatRelativeOrAbsoluteTime = (dateString?: string | null): string => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return '-';
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays > 15) {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return `${Math.max(1, diffSeconds)}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const days = Math.floor(diffHours / 24);
  return `${days}d ago`;
};

export const StatusChip = ({ status }: { status?: string | null }) => {
  if (!status) {
    return <Typography variant="body2" color="textSecondary">-</Typography>;
  }

  let borderColor = '#9e9e9e';
  let color = '#757575';

  const normalized = status.toUpperCase();
  if (normalized === 'SUCCESS' || normalized === 'COMPLETED') {
    borderColor = '#4caf50';
    color = '#4caf50';
  } else if (normalized === 'FAILED') {
    borderColor = '#f44336';
    color = '#f44336';
  } else if (normalized === 'RUNNING' || normalized === 'STARTED') {
    borderColor = '#2196f3';
    color = '#2196f3';
  }

  return (
    <Chip
      label={status}
      variant="outlined"
      size="small"
      style={{
        minWidth: 80,
        borderColor,
        color,
        fontWeight: 600,
        backgroundColor: 'transparent',
      }}
    />
  );
};

export const toYaml = (obj: any): string => {
  if (!obj || Object.keys(obj).length === 0) return 'No parameters';
  try {
    return yaml.stringify(obj).trim();
  } catch {
    return JSON.stringify(obj, null, 2);
  }
};

export const KeyValueParametersView = ({ parameters }: { parameters?: Record<string, any> }) => {
  const theme = useTheme();
  const entries = parameters ? Object.entries(parameters) : [];

  return (
    <Box
      margin={2}
      p={2}
      borderRadius={4}
      style={{
        backgroundColor: theme.palette.type === 'dark' ? theme.palette.background.paper : '#f9f9f9',
        border: `1px solid ${theme.palette.divider}`,
      }}
    >
      <Typography variant="subtitle2" gutterBottom style={{ fontWeight: 600 }}>
        Parameters:
      </Typography>
      {entries.length > 0 ? (
        <Grid container spacing={1}>
          {entries.map(([key, value]) => (
            <Grid item xs={12} sm={6} md={4} key={key}>
              <Box
                p={1}
                borderRadius={4}
                style={{
                  backgroundColor: theme.palette.type === 'dark' ? 'rgba(255, 255, 255, 0.05)' : '#ffffff',
                  border: `1px solid ${theme.palette.divider}`,
                }}
              >
                <Typography variant="caption" color="textSecondary" style={{ fontWeight: 600 }}>
                  {key}
                </Typography>
                <Typography variant="body2" style={{ wordBreak: 'break-all' }}>
                  {String(value)}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Typography variant="body2" color="textSecondary">-</Typography>
      )}
    </Box>
  );
};

