import {
  Page,
  Content,
  InfoCard,
  Progress,
  Link,
} from '@backstage/core-components';
import { useApi, useRouteRef } from '@backstage/core-plugin-api';
import { batchConsoleApiRef } from '../api/BatchConsoleApi';
import useAsync from 'react-use/lib/useAsync';
import { jobRunRouteRef } from '../routes';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import Table from '@material-ui/core/Table';
import TableHead from '@material-ui/core/TableHead';
import TableBody from '@material-ui/core/TableBody';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import IconButton from '@material-ui/core/IconButton';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import HistoryIcon from '@material-ui/icons/History';
import { formatRelativeOrAbsoluteTime, StatusChip } from './common';

export const BatchJobsPage = () => {
  const api = useApi(batchConsoleApiRef);
  const jobRunRoute = useRouteRef(jobRunRouteRef);

  const { value: jobs, loading } = useAsync(async () => {
    return await api.getJobs();
  }, [api]);

  const jobList = jobs || [];

  return (
    <Page themeId="tool">
      {/* Header commented out as requested */}
      {/* <Header title="Spring Batch Jobs" subtitle="Manage Batch Jobs" /> */}
      <Content>
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
                  <TableCell
                    style={{
                      fontWeight: 600,
                      color: 'rgba(0, 0, 0, 0.54)',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Job Name
                  </TableCell>
                  <TableCell
                    align="center"
                    style={{
                      fontWeight: 600,
                      color: 'rgba(0, 0, 0, 0.54)',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Restartable
                  </TableCell>
                  <TableCell
                    align="right"
                    style={{
                      fontWeight: 600,
                      color: 'rgba(0, 0, 0, 0.54)',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Total Runs
                  </TableCell>
                  <TableCell
                    align="center"
                    style={{
                      fontWeight: 600,
                      color: 'rgba(0, 0, 0, 0.54)',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Last Status
                  </TableCell>
                  <TableCell
                    style={{
                      fontWeight: 600,
                      color: 'rgba(0, 0, 0, 0.54)',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Last Run
                  </TableCell>
                  <TableCell
                    align="right"
                    style={{
                      fontWeight: 600,
                      color: 'rgba(0, 0, 0, 0.54)',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {jobList.map((job, idx) => {
                  const runUrl = jobRunRoute ? jobRunRoute({ jobName: job.name }) : `/platform/batch/jobs/${job.name}`;
                  return (
                    <TableRow
                      key={job.name}
                      hover
                      style={{
                        backgroundColor: idx % 2 === 1 ? 'rgba(0, 0, 0, 0.04)' : 'inherit',
                      }}
                    >
                      <TableCell>
                        <Link to={runUrl}>
                          <Typography variant="body2" style={{ fontWeight: 500 }}>
                            {job.name}
                          </Typography>
                        </Link>
                      </TableCell>
                      <TableCell align="center">
                        <Typography variant="body2">
                          {job.restartable ? 'Yes' : 'No'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {job.totalExecutions}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <StatusChip status={job.lastStatus} />
                      </TableCell>
                      <TableCell>
                        {formatRelativeOrAbsoluteTime(job.lastExecutionTime)}
                      </TableCell>
                      <TableCell align="right">
                        <Box display="flex" justifyContent="flex-end" alignItems="center">
                          <IconButton
                            size="small"
                            component={Link}
                            to={runUrl}
                            title="Run Job"
                            aria-label={`Run ${job.name}`}
                          >
                            <PlayArrowIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            component={Link}
                            to="/spring-batch"
                            title="History"
                            aria-label="View History"
                          >
                            <HistoryIcon />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </InfoCard>
      </Content>
    </Page>
  );
};

// Backward-compatible alias
export const BatchConsolePage = BatchJobsPage;
