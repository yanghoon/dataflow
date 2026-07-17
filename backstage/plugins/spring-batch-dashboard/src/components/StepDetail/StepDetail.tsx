import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Chip,
  Grid,
  Typography,
  Tooltip,
  Paper,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  Header,
  Page,
  Content,
  Progress,
  InfoCard,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { springBatchApiRef } from '../../api';
import type { Environment, StepExecution } from '../../types';
import { formatDateWithTimezone } from '../../utils/formatters';

export const StepDetail = () => {
  const { stepId } = useParams<{ stepId: string }>();
  const navigate = useNavigate();
  const api = useApi(springBatchApiRef);
  const [searchParams] = useSearchParams();
  const environment = (searchParams.get('environment') as Environment) || 'dev';
  const bootVersion = searchParams.get('bootVersion') as
    | 'Boot3'
    | 'Boot4'
    | null;

  const [step, setStep] = useState<StepExecution | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStep = async () => {
      if (!stepId) return;

      try {
        setLoading(true);
        const data = await api.getStepDetail(
          parseInt(stepId, 10),
          environment,
          bootVersion || undefined,
        );
        setStep(data);
      } catch (err: any) {
        setError(err.message || 'Failed to fetch step detail');
      } finally {
        setLoading(false);
      }
    };

    fetchStep();
  }, [stepId, environment, bootVersion, api]);

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
    status: string | null,
  ): 'primary' | 'error' | 'info' | 'default' => {
    if (status === 'COMPLETED') return 'primary';
    if (status === 'FAILED') return 'error';
    if (status === 'STARTED') return 'info';
    return 'default';
  };

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="Step Detail" subtitle="Loading..." />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error || !step) {
    return (
      <Page themeId="tool">
        <Header title="Step Detail" subtitle="Error" />
        <Content>
          <InfoCard title="Error">
            <Typography color="error">{error || 'Step not found'}</Typography>
          </InfoCard>
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header
        title={`Step: ${step.stepName}`}
        subtitle={`From Execution #${step.jobExecutionId}`}
      >
        <Chip
          label={step.status || 'UNKNOWN'}
          color={getStatusColor(step.status)}
          sx={{ fontWeight: 500, my: 0.5, verticalAlign: 'middle' }}
        />
      </Header>
      <Content>
        <Box sx={{ marginBottom: 3 }}>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>
            Back
          </Button>
        </Box>

        <Grid container spacing={3}>
          {/* Step Overview */}
          <Grid item xs={12} md={6}>
            <InfoCard title="Step Overview">
              <Box sx={{ display: 'flex', marginBottom: 2 }}>
                <Typography
                  sx={{
                    fontWeight: 600,
                    minWidth: 150,
                    color: 'text.secondary',
                  }}
                >
                  Step Execution ID:
                </Typography>
                <Typography sx={{ color: 'text.primary' }}>
                  {step.stepExecutionId}
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
                  Step Name:
                </Typography>
                <Typography sx={{ color: 'text.primary' }}>
                  {step.stepName}
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
                  Job Execution ID:
                </Typography>
                <Typography sx={{ color: 'text.primary' }}>
                  {step.jobExecutionId}
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
                  {step.version}
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
                <Typography sx={{ color: 'text.primary', fontWeight: 600 }}>
                  {formatDuration(step.startTime, step.endTime)}
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
                  {formatDateWithTimezone(step.startTime, environment)}
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
                  {formatDateWithTimezone(step.endTime, environment)}
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
                  {formatDateWithTimezone(step.createTime, environment)}
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
                  Last Updated:
                </Typography>
                <Typography sx={{ color: 'text.primary' }}>
                  {formatDateWithTimezone(step.lastUpdated, environment)}
                </Typography>
              </Box>
            </InfoCard>
          </Grid>

          {/* Count Metrics */}
          <Grid item xs={12} md={6}>
            <InfoCard title="Count Metrics">
              <Box sx={{ display: 'flex', marginBottom: 2 }}>
                <Typography
                  sx={{
                    fontWeight: 600,
                    minWidth: 150,
                    color: 'text.secondary',
                  }}
                >
                  Read Count:
                </Typography>
                <Typography sx={{ color: 'text.primary' }}>
                  {step.readCount ?? '-'}
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
                  Write Count:
                </Typography>
                <Typography sx={{ color: 'text.primary' }}>
                  {step.writeCount ?? '-'}
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
                  Filter Count:
                </Typography>
                <Typography sx={{ color: 'text.primary' }}>
                  {step.filterCount ?? '-'}
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
                  Commit Count:
                </Typography>
                <Typography sx={{ color: 'text.primary' }}>
                  {step.commitCount ?? '-'}
                </Typography>
              </Box>
            </InfoCard>
          </Grid>

          {/* Skip & Errors */}
          <Grid item xs={12} md={6}>
            <InfoCard title="Skip & Errors">
              <Box sx={{ display: 'flex', marginBottom: 2 }}>
                <Typography
                  sx={{
                    fontWeight: 600,
                    minWidth: 150,
                    color: 'text.secondary',
                  }}
                >
                  Read Skip Count:
                </Typography>
                <Typography
                  sx={{
                    color: step.readSkipCount ? 'error.main' : 'text.primary',
                  }}
                >
                  {step.readSkipCount ?? 0}
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
                  Write Skip Count:
                </Typography>
                <Typography
                  sx={{
                    color: step.writeSkipCount ? 'error.main' : 'text.primary',
                  }}
                >
                  {step.writeSkipCount ?? 0}
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
                  Process Skip Count:
                </Typography>
                <Typography
                  sx={{
                    color: step.processSkipCount
                      ? 'error.main'
                      : 'text.primary',
                  }}
                >
                  {step.processSkipCount ?? 0}
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
                  Rollback Count:
                </Typography>
                <Typography
                  sx={{
                    color: step.rollbackCount ? 'error.main' : 'text.primary',
                  }}
                >
                  {step.rollbackCount ?? 0}
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
                  Total Skips:
                </Typography>
                <Tooltip
                  title={
                    <div>
                      <div>Read Skip: {step.readSkipCount ?? 0}</div>
                      <div>Write Skip: {step.writeSkipCount ?? 0}</div>
                      <div>Process Skip: {step.processSkipCount ?? 0}</div>
                    </div>
                  }
                >
                  <Typography
                    sx={{
                      color:
                        (step.readSkipCount ?? 0) +
                          (step.writeSkipCount ?? 0) +
                          (step.processSkipCount ?? 0) >
                        0
                          ? 'error.main'
                          : 'text.primary',
                      fontWeight: 600,
                      cursor: 'help',
                      borderBottom: '1px dotted',
                    }}
                  >
                    {(step.readSkipCount ?? 0) +
                      (step.writeSkipCount ?? 0) +
                      (step.processSkipCount ?? 0)}
                  </Typography>
                </Tooltip>
              </Box>
            </InfoCard>
          </Grid>

          {/* Exit Code */}
          <Grid item xs={12}>
            <InfoCard title="Exit Information">
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
                  {step.exitCode || '-'}
                </Typography>
              </Box>
            </InfoCard>
          </Grid>

          {/* Exit Message */}
          <Grid item xs={12}>
            <InfoCard title="Exit Message">
              <Paper
                elevation={0}
                sx={{
                  padding: 2,
                  backgroundColor: step.exitMessage
                    ? 'error.light'
                    : 'grey.100',
                  borderRadius: 1,
                  marginTop: 2,
                }}
              >
                <Typography variant="body2" sx={{ color: '#000' }}>
                  {step.exitMessage || 'No message'}
                </Typography>
              </Paper>
            </InfoCard>
          </Grid>
        </Grid>
      </Content>
    </Page>
  );
};
