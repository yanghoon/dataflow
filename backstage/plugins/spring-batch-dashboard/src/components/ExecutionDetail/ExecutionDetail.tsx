import React from 'react';
import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Button,
  Paper,
  Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Progress,
  InfoCard,
  Page,
  Header,
  Content,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { springBatchApiRef } from '../../api';
import type { JobExecution, Environment } from '../../types';
import { formatDateWithTimezone } from '../../utils/formatters';

export const ExecutionDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const api = useApi(springBatchApiRef);

  const environment = (searchParams.get('environment') as Environment) || 'dev';
  const bootVersion = searchParams.get('bootVersion') as
    | 'Boot3'
    | 'Boot4'
    | null;
  const [execution, setExecution] = useState<JobExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchExecution = async () => {
      if (!id) return;

      try {
        setLoading(true);
        const data = await api.getExecutionDetail(
          parseInt(id, 10),
          environment,
          bootVersion || undefined,
        );
        setExecution(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch execution detail');
      } finally {
        setLoading(false);
      }
    };

    fetchExecution();
  }, [id, environment, bootVersion, api]);

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

  const getStatusColor = (
    status: string,
  ): 'primary' | 'error' | 'info' | 'default' => {
    if (status === 'COMPLETED') return 'primary';
    if (status === 'FAILED') return 'error';
    if (status === 'STARTED') return 'info';
    return 'default'; // UNKNOWN, STOPPED, ABANDONED, and any other status
  };

  const getStatusChipStyle = (status: string) => {
    const baseStyle = {
      fontWeight: 500,
      my: 0.5,
      verticalAlign: 'middle',
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

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="Execution Detail" />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error || !execution) {
    return (
      <Page themeId="tool">
        <Header title="Execution Detail" />
        <Content>
          <InfoCard title="Error">
            <Typography color="error">
              {error || 'Execution not found'}
            </Typography>
          </InfoCard>
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header
        title={`Execution #${execution.jobExecutionId}`}
        subtitle={execution.jobName || 'Unknown Job'}
      >
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Chip
            label={execution.status}
            color={getStatusColor(execution.status)}
            sx={{ marginLeft: 2, fontWeight: 500, my: 0.5, verticalAlign: 'middle' }}
          />
        </Box>
      </Header>
      <Content>
        <Box sx={{ marginBottom: 3 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
            sx={{ marginRight: 1 }}
          >
            Back
          </Button>
          <Button
            variant="outlined"
            color="primary"
            onClick={() => {
              const bootVersionParam = execution.bootVersion
                ? `&bootVersion=${encodeURIComponent(execution.bootVersion)}`
                : '';
              navigate(
                `/spring-batch/instances/${execution.jobInstanceId}/history?environment=${environment}${bootVersionParam}`,
              );
            }}
          >
            View History
          </Button>
        </Box>

        <Grid container spacing={3}>
          {/* Execution Details */}
          <Grid item xs={12} md={6}>
            <InfoCard title="Execution Details">
              <Box sx={{ display: 'flex', marginBottom: 2 }}>
                <Typography
                  sx={{
                    fontWeight: 600,
                    minWidth: 150,
                    color: 'text.secondary',
                  }}
                >
                  Job Execution ID:
                </Typography>
                <Typography sx={{ color: 'text.primary' }}>
                  {execution.jobExecutionId}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', marginBottom: 2 }}>
                <Typography
                  sx={{
                    fontWeight: 600,
                    minWidth: 150,
                    color: 'text.secondary',
                  }}
                >
                  Job Instance ID:
                </Typography>
                <Typography sx={{ color: 'text.primary' }}>
                  {execution.jobInstanceId}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', marginBottom: 2 }}>
                <Typography
                  sx={{
                    fontWeight: 600,
                    minWidth: 150,
                    color: 'text.secondary',
                  }}
                >
                  Version:
                </Typography>
                <Typography sx={{ color: 'text.primary' }}>
                  {execution.version}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', marginBottom: 2 }}>
                <Typography
                  sx={{
                    fontWeight: 600,
                    minWidth: 150,
                    color: 'text.secondary',
                  }}
                >
                  Exit Code:
                </Typography>
                <Typography sx={{ color: 'text.primary' }}>
                  {execution.exitCode || '-'}
                </Typography>
              </Box>
            </InfoCard>
          </Grid>

          {/* Timing Information */}
          <Grid item xs={12} md={6}>
            <InfoCard title="Timing Information">
              <Box sx={{ display: 'flex', marginBottom: 2 }}>
                <Typography
                  sx={{
                    fontWeight: 600,
                    minWidth: 150,
                    color: 'text.secondary',
                  }}
                >
                  Start Time:
                </Typography>
                <Typography sx={{ color: 'text.primary' }}>
                  {formatDateWithTimezone(execution.startTime, environment)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', marginBottom: 2 }}>
                <Typography
                  sx={{
                    fontWeight: 600,
                    minWidth: 150,
                    color: 'text.secondary',
                  }}
                >
                  End Time:
                </Typography>
                <Typography sx={{ color: 'text.primary' }}>
                  {formatDateWithTimezone(execution.endTime, environment)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', marginBottom: 2 }}>
                <Typography
                  sx={{
                    fontWeight: 600,
                    minWidth: 150,
                    color: 'text.secondary',
                  }}
                >
                  Create Time:
                </Typography>
                <Typography sx={{ color: 'text.primary' }}>
                  {formatDateWithTimezone(execution.createTime, environment)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', marginBottom: 2 }}>
                <Typography
                  sx={{
                    fontWeight: 600,
                    minWidth: 150,
                    color: 'text.secondary',
                  }}
                >
                  Duration:
                </Typography>
                <Typography sx={{ color: 'text.primary' }}>
                  {formatDuration(execution.startTime, execution.endTime)}
                </Typography>
              </Box>
            </InfoCard>
          </Grid>

          {/* Exit Message */}
          {execution.exitMessage && (
            <Grid item xs={12}>
              <InfoCard title="Exit Message">
                <Paper
                  elevation={0}
                  sx={{
                    padding: 2,
                    backgroundColor: 'error.light',
                    borderRadius: 1,
                    marginTop: 2,
                  }}
                >
                  <Typography variant="body2" sx={{ color: '#000' }}>
                    {execution.exitMessage}
                  </Typography>
                </Paper>
              </InfoCard>
            </Grid>
          )}

          {/* Parameters */}
          {execution.parameters && execution.parameters.length > 0 && (
            <Grid item xs={12}>
              <InfoCard title={`Parameters (${execution.parameters.length})`}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Name</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell>Value</TableCell>
                        <TableCell>Identifying</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {execution.parameters.map((param, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 500 }}
                            >
                              {param.parameterName}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" color="textSecondary">
                              {param.parameterType.split('.').pop()}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {param.parameterValue}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={param.identifying === 'Y' ? 'Yes' : 'No'}
                              size="small"
                              color={
                                param.identifying === 'Y'
                                  ? 'primary'
                                  : 'default'
                              }
                              sx={{ my: 0.5, verticalAlign: 'middle' }}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </InfoCard>
            </Grid>
          )}

          {/* Steps */}
          {execution.steps && execution.steps.length > 0 && (
            <Grid item xs={12}>
              <InfoCard title={`Steps (${execution.steps.length})`}>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ minWidth: 80 }}>ID</TableCell>
                        <TableCell>Step Name</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell align="right">Read</TableCell>
                        <TableCell align="right">Write</TableCell>
                        <TableCell align="right">Filter</TableCell>
                        <TableCell align="right">Skip</TableCell>
                        <TableCell align="right">Rollback</TableCell>
                        <TableCell>Duration</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {execution.steps.map(step => (
                        <TableRow
                          key={step.stepExecutionId}
                          hover
                          sx={{
                            cursor: 'pointer',
                            '&:hover': { backgroundColor: 'action.hover' },
                          }}
                          onClick={() => {
                            const bootVersionParam = step.bootVersion
                              ? `&bootVersion=${encodeURIComponent(step.bootVersion)}`
                              : '';
                            navigate(
                              `/spring-batch/steps/${step.stepExecutionId}?environment=${environment}${bootVersionParam}`,
                            );
                          }}
                        >
                          <TableCell sx={{ minWidth: 80 }}>
                            <Typography variant="body2" color="textSecondary">
                              {step.stepExecutionId}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Typography
                              variant="body2"
                              sx={{ fontWeight: 500 }}
                            >
                              {step.stepName}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={step.status}
                              size="small"
                              sx={getStatusChipStyle(step.status)}
                            />
                          </TableCell>
                          <TableCell align="right">{step.readCount}</TableCell>
                          <TableCell align="right">{step.writeCount}</TableCell>
                          <TableCell align="right">
                            {step.filterCount}
                          </TableCell>
                          <TableCell align="right">
                            <Tooltip
                              title={
                                <div>
                                  <div>Read Skip: {step.readSkipCount}</div>
                                  <div>Write Skip: {step.writeSkipCount}</div>
                                  <div>
                                    Process Skip: {step.processSkipCount}
                                  </div>
                                </div>
                              }
                            >
                              <Box
                                component="span"
                                sx={{
                                  cursor: 'help',
                                  borderBottom: '1px dotted',
                                }}
                              >
                                {step.readSkipCount +
                                  step.writeSkipCount +
                                  step.processSkipCount}
                              </Box>
                            </Tooltip>
                          </TableCell>
                          <TableCell align="right">
                            {step.rollbackCount}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2">
                              {formatDuration(step.startTime, step.endTime)}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </InfoCard>
            </Grid>
          )}
        </Grid>
      </Content>
    </Page>
  );
};
