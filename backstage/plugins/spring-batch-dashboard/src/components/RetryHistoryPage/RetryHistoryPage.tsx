import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useApi, useRouteRef } from '@backstage/core-plugin-api';
import { springBatchApiRef } from '../../api';
import { executionDetailRouteRef } from '../../routes';
import {
  Content,
  Header,
  Page,
  Progress,
  InfoCard,
} from '@backstage/core-components';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Chip,
  Box,
  Button,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import type { JobExecution, Environment } from '../../types';
import { formatDateWithTimezone } from '../../utils/formatters';

const formatDuration = (
  start: Date | string | null,
  end: Date | string | null,
): string => {
  if (!start || !end) return 'N/A';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
};

const getStatusColor = (
  status: string,
): 'default' | 'primary' | 'secondary' => {
  switch (status) {
    case 'COMPLETED':
      return 'primary';
    case 'FAILED':
      return 'secondary';
    default:
      return 'default';
  }
};

const getStatusStyle = (status: string) => {
  const baseStyle = {
    my: 0.5,
    verticalAlign: 'middle',
  };

  switch (status) {
    case 'COMPLETED':
      return { ...baseStyle, backgroundColor: '#4caf50', color: 'white' };
    case 'FAILED':
      return { ...baseStyle, backgroundColor: '#f44336', color: 'white' };
    case 'STARTED':
      return { ...baseStyle, backgroundColor: '#2196f3', color: 'white' };
    default:
      return baseStyle;
  }
};

export const RetryHistoryPage = () => {
  const { instanceId } = useParams<{ instanceId: string }>();
  const api = useApi(springBatchApiRef);
  const navigate = useNavigate();
  const detailLink = useRouteRef(executionDetailRouteRef);
  const [searchParams] = useSearchParams();

  const environment = (searchParams.get('environment') as Environment) || 'dev';
  const bootVersion = searchParams.get('bootVersion') as
    | 'Boot3'
    | 'Boot4'
    | null;
  const [executions, setExecutions] = useState<JobExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExecutions = async () => {
      if (!instanceId) return;

      setLoading(true);
      setError(null);
      try {
        const data = await api.getJobInstanceExecutions(
          parseInt(instanceId, 10),
          environment,
          bootVersion || undefined,
        );
        setExecutions(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch execution history');
      } finally {
        setLoading(false);
      }
    };

    fetchExecutions();
  }, [api, instanceId, environment, bootVersion]);

  const handleRowClick = (execution: JobExecution) => {
    const bootVersionParam = execution.bootVersion
      ? `&bootVersion=${encodeURIComponent(execution.bootVersion)}`
      : '';
    const link = detailLink({ id: execution.jobExecutionId.toString() });
    navigate(
      `${link}?environment=${environment}${bootVersionParam}`,
    );
  };

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="History" subtitle="Execution History by Job Instance" />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error) {
    return (
      <Page themeId="tool">
        <Header title="History" subtitle="Execution History by Job Instance" />
        <Content>
          <InfoCard title="Error">
            <Typography color="error">{error}</Typography>
          </InfoCard>
        </Content>
      </Page>
    );
  }

  const jobName = executions[0]?.jobName || 'Unknown Job';

  return (
    <Page themeId="tool">
      <Header
        title={`History - ${jobName}`}
        subtitle={`Job Instance ID: ${instanceId}`}
      />
      <Content>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate(-1)}
          sx={{ marginBottom: 2 }}
        >
          Back
        </Button>

        <InfoCard title={`Total Executions: ${executions.length}`}>
          {executions.length === 0 ? (
            <Typography>No execution history.</Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Execution ID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Start Time</TableCell>
                  <TableCell>End Time</TableCell>
                  <TableCell>Duration</TableCell>
                  <TableCell>Exit Message</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {executions.map(execution => (
                  <TableRow
                    key={execution.jobExecutionId}
                    hover
                    sx={{
                      cursor: 'pointer',
                      '&:hover': { backgroundColor: 'action.hover' },
                    }}
                    onClick={() => handleRowClick(execution)}
                  >
                    <TableCell>{execution.jobExecutionId}</TableCell>
                    <TableCell>
                      <Chip
                        label={execution.status}
                        color={getStatusColor(execution.status)}
                        sx={getStatusStyle(execution.status)}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {formatDateWithTimezone(execution.startTime, environment)}
                    </TableCell>
                    <TableCell>
                      {formatDateWithTimezone(execution.endTime, environment)}
                    </TableCell>
                    <TableCell>
                      {formatDuration(execution.startTime, execution.endTime)}
                    </TableCell>
                    <TableCell>
                      <Box
                        sx={{
                          maxWidth: 300,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {execution.exitMessage || 'N/A'}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </InfoCard>
      </Content>
    </Page>
  );
};
