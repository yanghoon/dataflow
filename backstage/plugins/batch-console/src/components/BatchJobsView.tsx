import { useState } from 'react';
import { InfoCard, Progress, Link } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { batchConsoleApiRef } from '../api/BatchConsoleApi';
import useAsyncRetry from 'react-use/lib/useAsyncRetry';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import Table from '@material-ui/core/Table';
import TableHead from '@material-ui/core/TableHead';
import TableBody from '@material-ui/core/TableBody';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import HistoryIcon from '@material-ui/icons/History';
import { useTheme } from '@material-ui/core/styles';
import { formatRelativeOrAbsoluteTime, StatusChip } from './common';
import { RunJobDialog } from './RunJobDialog';

export const BatchJobsView = () => {
  const theme = useTheme();
  const api = useApi(batchConsoleApiRef);

  const { value: jobs, loading, retry } = useAsyncRetry(async () => {
    return await api.getJobs();
  }, [api]);

  const [runModalOpen, setRunModalOpen] = useState(false);
  const [selectedJobName, setSelectedJobName] = useState('');

  const handleOpenRunModal = (jobName: string) => {
    setSelectedJobName(jobName);
    setRunModalOpen(true);
  };

  const jobList = jobs || [];

  const headerCellStyle = {
    fontWeight: 600,
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  };

  return (
    <>
      <InfoCard title={`Spring Batch Jobs (${jobList.length})`}>
        {loading && jobList.length === 0 ? (
          <Progress />
        ) : jobList.length === 0 ? (
          <Typography variant="body2" color="textSecondary">
            No jobs found.
          </Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell style={headerCellStyle}>Job Name</TableCell>
                <TableCell align="center" style={headerCellStyle}>Restartable</TableCell>
                <TableCell align="right" style={headerCellStyle}>Total Runs</TableCell>
                <TableCell align="center" style={headerCellStyle}>Last Status</TableCell>
                <TableCell style={headerCellStyle}>Last Run</TableCell>
                <TableCell align="right" style={headerCellStyle}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {jobList.map((job, idx) => (
                <TableRow
                  key={job.name}
                  hover
                  style={{
                    backgroundColor: idx % 2 === 1 ? theme.palette.action.hover : 'inherit',
                  }}
                >
                  <TableCell>
                    {/* Link 제거, 순수 텍스트 표시 */}
                    <Typography variant="body2" style={{ fontWeight: 500 }}>
                      {job.name}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Typography variant="body2">{job.restartable ? 'Yes' : 'No'}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2">{job.totalExecutions}</Typography>
                  </TableCell>
                  <TableCell align="center">
                    <StatusChip status={job.lastStatus} />
                  </TableCell>
                  <TableCell>{formatRelativeOrAbsoluteTime(job.lastExecutionTime)}</TableCell>
                  <TableCell align="right">
                    <Box display="flex" justifyContent="flex-end" alignItems="center">
                      {/* Outlined Run Button with PlayArrow Icon */}
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        startIcon={<PlayArrowIcon />}
                        onClick={() => handleOpenRunModal(job.name)}
                        style={{ marginRight: 8 }}
                        aria-label={`Run ${job.name}`}
                      >
                        Run
                      </Button>
                      {/* History Icon Button */}
                      <IconButton
                        size="small"
                        component={Link}
                        to="/spring-batch"
                        title="History"
                        aria-label="View History"
                      >
                        <HistoryIcon color="action" />
                      </IconButton>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </InfoCard>

      {/* Run Job Dialog */}
      <RunJobDialog
        open={runModalOpen}
        jobName={selectedJobName}
        onClose={() => setRunModalOpen(false)}
        onSuccess={() => retry()}
      />
    </>
  );
};
