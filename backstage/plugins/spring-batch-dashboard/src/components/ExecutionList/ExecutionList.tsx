import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Autorenew as AutorenewIcon,
  Cancel as CancelIcon,
} from '@mui/icons-material';
import type { JobExecution, Environment } from '../../types';
import { formatDateWithTimezone } from '../../utils/formatters';

interface ExecutionListProps {
  executions: JobExecution[];
  onRowClick?: (execution: JobExecution) => void;
  environment: Environment;
}

export const ExecutionList = ({
  executions,
  onRowClick,
  environment,
}: ExecutionListProps) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircleIcon fontSize="small" />;
      case 'FAILED':
        return <ErrorIcon fontSize="small" />;
      case 'STARTED':
        return <AutorenewIcon fontSize="small" />;
      default:
        return <CancelIcon fontSize="small" />;
    }
  };

  const getStatusChipStyle = (status: string) => {
    const baseStyle = {
      fontWeight: 500,
      verticalAlign: 'middle',
      my: 0.5,
      '& .MuiChip-icon': {
        marginTop: '0px',
        marginBottom: '0px',
      },
    };

    if (status === 'COMPLETED') {
      return {
        ...baseStyle,
        backgroundColor: 'success.main',
        color: 'success.contrastText',
      };
    }
    if (status === 'FAILED') {
      return {
        ...baseStyle,
        backgroundColor: 'error.main',
        color: 'error.contrastText',
      };
    }
    if (status === 'STARTED') {
      return {
        ...baseStyle,
        backgroundColor: 'warning.main',
        color: 'warning.contrastText',
      };
    }
    return {
      ...baseStyle,
      backgroundColor: 'grey.500',
      color: 'common.white',
    };
  };

  const formatDuration = (startTime: Date | null, endTime: Date | null) => {
    if (!startTime) return '-';
    if (!endTime) return 'Running...';

    const start = new Date(startTime).getTime();
    const end = new Date(endTime).getTime();
    const durationMs = end - start;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);

    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    }
    return `${seconds}s`;
  };

  if (executions.length === 0) {
    return (
      <Paper sx={{ padding: '2rem', textAlign: 'center' }}>
        <Typography variant="body1" color="textSecondary">
          No job executions found
        </Typography>
      </Paper>
    );
  }

  return (
    <TableContainer component={Paper}>
      <Table sx={{ minWidth: 650, '& .MuiTableCell-root': { verticalAlign: 'middle' } }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ minWidth: 80, whiteSpace: 'nowrap' }}>
              ID
            </TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>Job Name</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>Status</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>Boot Version</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>Duration</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>Start Time</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>End Time</TableCell>
            <TableCell sx={{ whiteSpace: 'nowrap' }}>Exit Message</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {executions.map(execution => (
            <TableRow
              key={`${execution.jobExecutionId}-${execution.bootVersion || 'unknown'}`}
              sx={
                onRowClick
                  ? {
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: 'action.hover' },
                    }
                  : {}
              }
              onClick={() => onRowClick?.(execution)}
            >
              <TableCell sx={{ minWidth: 80 }}>
                <Typography variant="body2" color="textSecondary">
                  {execution.jobExecutionId}
                </Typography>
              </TableCell>
              <TableCell sx={{ fontWeight: 500 }}>
                {execution.jobName || 'Unknown'}
              </TableCell>
              <TableCell>
                <Chip
                  icon={getStatusIcon(execution.status)}
                  label={execution.status}
                  size="small"
                  sx={getStatusChipStyle(execution.status)}
                />
              </TableCell>
              <TableCell>
                {execution.bootVersion ? (
                  <Chip
                    label={execution.bootVersion}
                    size="small"
                    sx={{
                      backgroundColor:
                        execution.bootVersion === 'Boot3'
                          ? 'info.main'
                          : 'secondary.main',
                      color: 'common.white',
                      fontWeight: 500,
                      verticalAlign: 'middle',
                      my: 0.5,
                    }}
                  />
                ) : (
                  <Typography variant="body2" color="textSecondary">
                    -
                  </Typography>
                )}
              </TableCell>
              <TableCell>
                {formatDuration(execution.startTime, execution.endTime)}
              </TableCell>
              <TableCell>
                {formatDateWithTimezone(execution.startTime, environment)}
              </TableCell>
              <TableCell>
                {formatDateWithTimezone(execution.endTime, environment)}
              </TableCell>
              <TableCell>
                {execution.exitMessage ? (
                  <Typography variant="body2" color="error">
                    {execution.exitMessage.substring(0, 50)}
                    {execution.exitMessage.length > 50 ? '...' : ''}
                  </Typography>
                ) : (
                  '-'
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
