import React from 'react';
import {
  Content,
  Header,
  InfoCard,
  Page,
  Progress,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import {
  Alert,
  Box,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { springBatchApiRef } from '../../api';
import { useDateRange, useEnvironmentSelector } from '../../hooks';
import type { JobExecution } from '../../types';
import { formatDuration } from '../../utils';
import {
  BootVersionChip,
  DateRangeSelector,
  EnvironmentSelector,
  RecentExecutionsTable,
  StatisticsCard,
  StatusChip,
} from '../common';

export const SpringBatchPage = () => {
  const navigate = useNavigate();
  const api = useApi(springBatchApiRef);

  const { environment, setEnvironment } = useEnvironmentSelector();
  const {
    fromDate,
    toDate,
    setFromDate,
    setToDate,
    handleQuickSelect,
    fromISO,
    toISO,
  } = useDateRange();

  const [allExecutions, setAllExecutions] = useState<JobExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bootVersionFilter, setBootVersionFilter] = useState<
    'Boot3' | 'Boot4' | ''
  >('');

  // biome-ignore lint/correctness/useExhaustiveDependencies: environment is the only dependency that should trigger the effect
  useEffect(() => {
    fetchData();
  }, [environment, fromDate, toDate, bootVersionFilter]);

  const fetchData = async () => {
    try {
      setLoading(true);

      const executionsData = await api.getExecutions(
        {
          limit: 1000,
          offset: 0,
          from: fromISO || undefined,
          to: toISO || undefined,
        },
        environment,
        bootVersionFilter || undefined,
      );

      setAllExecutions(executionsData);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(
    () => ({
      total: allExecutions.length,
      completed: allExecutions.filter(e => e.status === 'COMPLETED').length,
      failed: allExecutions.filter(e => e.status === 'FAILED').length,
      started: allExecutions.filter(e => e.status === 'STARTED').length,
    }),
    [allExecutions],
  );

  // Calculate job summaries from ALL executions (not filtered)
  const jobSummaries = useMemo(() => {
    const summaryMap = new Map<
      string,
      {
        jobName: string;
        executions: JobExecution[];
      }
    >();

    // Group executions by job name
    allExecutions.forEach(execution => {
      if (!execution.jobName) return;

      if (!summaryMap.has(execution.jobName)) {
        summaryMap.set(execution.jobName, {
          jobName: execution.jobName,
          executions: [],
        });
      }
      summaryMap.get(execution.jobName)?.executions.push(execution);
    });

    // Calculate summary for each job
    return Array.from(summaryMap.values())
      .map(({ jobName, executions: jobExecs }) => {
        // Sort by start time descending to get the latest execution
        const sortedExecs = [...jobExecs].sort((a, b) => {
          const timeA = a.startTime ? new Date(a.startTime).getTime() : 0;
          const timeB = b.startTime ? new Date(b.startTime).getTime() : 0;
          return timeB - timeA;
        });

        const latestExec = sortedExecs[0];

        // Calculate average duration (only for completed executions)
        const completedExecs = jobExecs.filter(e => e.endTime && e.startTime);
        const avgDurationMs =
          completedExecs.length > 0
            ? completedExecs.reduce((sum, e) => {
                if (!e.endTime || !e.startTime) return sum;
                const duration =
                  new Date(e.endTime).getTime() -
                  new Date(e.startTime).getTime();
                return sum + duration;
              }, 0) / completedExecs.length
            : null;

        return {
          jobName,
          totalExecutions: jobExecs.length,
          successCount: jobExecs.filter(e => e.status === 'COMPLETED').length,
          failureCount: jobExecs.filter(e => e.status === 'FAILED').length,
          runningCount: jobExecs.filter(e => e.status === 'STARTED').length,
          avgDurationMs,
          lastStatus: latestExec.status,
          lastExecutionTime: latestExec.startTime,
          bootVersion: latestExec.bootVersion,
          lastJobInstanceId: latestExec.jobInstanceId,
        };
      })
      .sort((a, b) => a.jobName.localeCompare(b.jobName));
  }, [allExecutions]);

  if (loading && allExecutions.length === 0) {
    return (
      <Page themeId="tool">
        <Header
          title="Spring Batch Dashboard"
          subtitle="Monitor Spring Batch job executions"
        />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header
        title="Spring Batch Dashboard"
        subtitle="Monitor Spring Batch job executions"
      />
      <Content>
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* Environment Selector */}
        <EnvironmentSelector
          value={environment}
          onChange={setEnvironment}
          loading={loading}
        />

        {/* Date Range Selector */}
        <DateRangeSelector
          fromDate={fromDate}
          toDate={toDate}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          onQuickSelect={handleQuickSelect}
        />

        {/* Statistics Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatisticsCard
              value={stats.total}
              label="Total Executions"
              type="primary"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatisticsCard
              value={stats.completed}
              label="Completed"
              type="completed"
              textType="completed"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatisticsCard
              value={stats.failed}
              label="Failed"
              type="failed"
              textType="failed"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatisticsCard
              value={stats.started}
              label="Running"
              type="running"
              textType="running"
            />
          </Grid>
        </Grid>

        {/* Job Summary Table */}
        <Box
          sx={{
            mb: 4,
            mt: 3,
            border: '1px solid',
            borderColor: 'divider',
            borderRadius: 1,
          }}
        >
          <InfoCard title={`Job Summary (${jobSummaries.length})`}>
            {jobSummaries.length === 0 ? (
              <Typography>No jobs executed on this date.</Typography>
            ) : (
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        fontWeight: 600,
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Job Name
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 600,
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Instance ID
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 600,
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Total
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 600,
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Success
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 600,
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Failed
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 600,
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Running
                    </TableCell>
                    <TableCell
                      align="right"
                      sx={{
                        fontWeight: 600,
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Avg Duration
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        fontWeight: 600,
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Boot Version
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        fontWeight: 600,
                        color: 'text.secondary',
                        fontSize: '0.75rem',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}
                    >
                      Last Status
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {jobSummaries.map(summary => (
                    <TableRow
                      key={summary.jobName}
                      hover
                      sx={{
                        cursor: summary.lastJobInstanceId
                          ? 'pointer'
                          : 'default',
                        '&:nth-of-type(odd)': { bgcolor: 'action.hover' },
                        '&:hover': summary.lastJobInstanceId
                          ? { backgroundColor: 'action.hover' }
                          : {},
                      }}
                      onClick={() => {
                        if (summary.lastJobInstanceId) {
                          const bootVersionParam = summary.bootVersion
                            ? `&bootVersion=${encodeURIComponent(summary.bootVersion)}`
                            : '';
                          navigate(
                            `/spring-batch/instances/${summary.lastJobInstanceId}/history?environment=${environment}${bootVersionParam}`,
                          );
                        }
                      }}
                    >
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {summary.jobName}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="textSecondary">
                          {summary.lastJobInstanceId || '-'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {summary.totalExecutions}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ color: 'success.main', fontWeight: 600 }}
                      >
                        {summary.successCount}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ color: 'error.main', fontWeight: 600 }}
                      >
                        {summary.failureCount}
                      </TableCell>
                      <TableCell
                        align="right"
                        sx={{ color: 'info.main', fontWeight: 600 }}
                      >
                        {summary.runningCount}
                      </TableCell>
                      <TableCell align="right">
                        {formatDuration(summary.avgDurationMs)}
                      </TableCell>
                      <TableCell align="center">
                        <BootVersionChip bootVersion={summary.bootVersion} />
                      </TableCell>
                      <TableCell align="center">
                        <StatusChip status={summary.lastStatus} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </InfoCard>
        </Box>

        {/* Recent Executions */}
        <RecentExecutionsTable
          environment={environment}
          bootVersionFilter={bootVersionFilter}
          onBootVersionChange={setBootVersionFilter}
          showPagination={false}
          executions={allExecutions}
        />
      </Content>
    </Page>
  );
};
