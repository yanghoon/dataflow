import {
  Content,
  Header,
  InfoCard,
  Page,
  Progress,
} from '@backstage/core-components';
import { useApi, useRouteRef } from '@backstage/core-plugin-api';
import { executionDetailRouteRef } from '../../routes';
import {
  Box,
  Chip,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { springBatchApiRef } from '../../api';
import { useDateRange, useEnvironmentSelector } from '../../hooks';
import type { JobExecution } from '../../types';
import { BOOT_VERSIONS, formatDuration } from '../../utils';
import { formatDateWithTimezone } from '../../utils/formatters';
import {
  BootVersionChip,
  DateRangeSelector,
  EnvironmentSelector,
  FilterSelect,
  StatisticsCard,
} from '../common';

interface FailureGroup {
  jobName: string;
  failureCount: number;
  lastFailure: Date;
  lastMessage: string | null;
  bootVersion?: 'Boot3' | 'Boot4';
}

export const FailuresPage = () => {
  const api = useApi(springBatchApiRef);
  const navigate = useNavigate();
  const detailLink = useRouteRef(executionDetailRouteRef);

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

  const [failures, setFailures] = useState<JobExecution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [jobNameFilter, setJobNameFilter] = useState<string>('');
  const [bootVersionFilter, setBootVersionFilter] = useState<
    'Boot3' | 'Boot4' | ''
  >('');

  // biome-ignore lint/correctness/useExhaustiveDependencies: environment is the only dependency that should trigger the effect
  useEffect(() => {
    fetchFailures();
  }, [api, environment, fromDate, toDate, jobNameFilter, bootVersionFilter]);

  const fetchFailures = async () => {
    setLoading(true);
    setError(null);
    try {
      const query: any = {
        status: 'FAILED',
        from: fromISO || undefined,
        to: toISO || undefined,
        limit: 100,
      };

      if (jobNameFilter) {
        query.jobName = jobNameFilter;
      }

      const failedExecutions = await api.getExecutions(
        query,
        environment,
        bootVersionFilter || undefined,
      );

      setFailures(failedExecutions);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch failures');
    } finally {
      setLoading(false);
    }
  };

  const handleRowClick = (execution: JobExecution) => {
    const bootVersionParam = execution.bootVersion
      ? `&bootVersion=${encodeURIComponent(execution.bootVersion)}`
      : '';
    const link = detailLink({ id: execution.jobExecutionId.toString() });
    navigate(
      `${link}?environment=${environment}${bootVersionParam}`,
    );
  };

  const uniqueJobNames = useMemo(
    () =>
      Array.from(
        new Set(failures.map(e => e.jobName).filter(Boolean)),
      ).sort() as string[],
    [failures],
  );

  // Compute filtered groups based on failures
  const filteredGroups = useMemo(() => {
    const groupMap = new Map<string, FailureGroup>();
    failures.forEach(exec => {
      const jobName = exec.jobName || 'Unknown';
      const existing = groupMap.get(jobName);

      if (!existing) {
        groupMap.set(jobName, {
          jobName,
          failureCount: 1,
          lastFailure: exec.startTime || exec.createTime,
          lastMessage: exec.exitMessage,
          bootVersion: exec.bootVersion,
        });
      } else {
        existing.failureCount += 1;
        const currentDate = new Date(exec.startTime || exec.createTime);
        const existingDate = new Date(existing.lastFailure);
        if (currentDate > existingDate) {
          existing.lastFailure = exec.startTime || exec.createTime;
          existing.lastMessage = exec.exitMessage;
          existing.bootVersion = exec.bootVersion;
        }
      }
    });

    return Array.from(groupMap.values()).sort(
      (a, b) => b.failureCount - a.failureCount,
    );
  }, [failures]);

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="Failures" subtitle="Failed Batch Job Monitoring" />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error) {
    return (
      <Page themeId="tool">
        <Header title="Failures" subtitle="Failed Batch Job Monitoring" />
        <Content>
          <InfoCard title="Error">
            <Typography color="error">{error}</Typography>
          </InfoCard>
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header title="Failures" subtitle="Failed Batch Job Monitoring" />
      <Content>
        {/* Environment Selector */}
        <EnvironmentSelector
          value={environment}
          onChange={setEnvironment}
          loading={loading}
        />

        {/* Date Selector */}
        <DateRangeSelector
          fromDate={fromDate}
          toDate={toDate}
          onFromDateChange={setFromDate}
          onToDateChange={setToDate}
          onQuickSelect={handleQuickSelect}
        />

        {/* Stat Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={4}>
            <StatisticsCard
              value={failures.length}
              label="Total Failures"
              type="failed"
              textType="failed"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatisticsCard
              value={filteredGroups.length}
              label="Affected Jobs"
              type="failed"
              textType="failed"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatisticsCard
              value={filteredGroups[0]?.jobName || 'N/A'}
              label="Most Failures"
              type="failed"
              textType="failed"
            />
          </Grid>
        </Grid>

        {/* Failure Groups */}
        {filteredGroups.length > 0 && (
          <Box mb={3}>
            <InfoCard
              title={`Failure Groups by Job (${filteredGroups.length})`}
            >
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Job Name</TableCell>
                    <TableCell align="right">Failure Count</TableCell>
                    <TableCell>Boot Version</TableCell>
                    <TableCell>Last Failure</TableCell>
                    <TableCell sx={{ maxWidth: 400 }}>
                      Last Error Message
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredGroups.map(group => (
                    <TableRow key={group.jobName}>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {group.jobName}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Chip
                          label={`${group.failureCount} times`}
                          color="secondary"
                          size="small"
                          sx={{ my: 0.5, verticalAlign: 'middle' }}
                        />
                      </TableCell>
                      <TableCell>
                        <BootVersionChip bootVersion={group.bootVersion} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatDateWithTimezone(
                            group.lastFailure,
                            environment,
                          )}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 400 }}>
                        {group.lastMessage ? (
                          <Tooltip title={group.lastMessage}>
                            <Typography
                              variant="caption"
                              color="error"
                              sx={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                display: 'block',
                              }}
                            >
                              {group.lastMessage}
                            </Typography>
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" color="textSecondary">
                            N/A
                          </Typography>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </InfoCard>
          </Box>
        )}

        {/* Recent Failures Table */}
        <InfoCard title={`Recent Failures (${failures.length})`}>
          {failures.length === 0 ? (
            <Typography>No failed jobs. 🎉</Typography>
          ) : (
            <>
              <Box sx={{ mb: 3 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item>
                    <FilterSelect
                      label="Job Name"
                      value={jobNameFilter}
                      onChange={setJobNameFilter}
                      options={uniqueJobNames}
                    />
                  </Grid>
                  <Grid item>
                    <FilterSelect
                      label="Boot Version"
                      value={bootVersionFilter}
                      onChange={value =>
                        setBootVersionFilter(value as 'Boot3' | 'Boot4' | '')
                      }
                      options={BOOT_VERSIONS}
                    />
                  </Grid>
                </Grid>
              </Box>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>ID</TableCell>
                    <TableCell>Job Name</TableCell>
                    <TableCell>Boot Version</TableCell>
                    <TableCell>Start Time</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell>Exit Message</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {failures.map((execution: JobExecution) => (
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
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {execution.jobName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <BootVersionChip bootVersion={execution.bootVersion} />
                      </TableCell>
                      <TableCell>
                        {formatDateWithTimezone(
                          execution.startTime,
                          environment,
                        )}
                      </TableCell>
                      <TableCell>
                        {formatDuration(execution.startTime, execution.endTime)}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 300 }}>
                        <Tooltip title={execution.exitMessage || ''}>
                          <Typography
                            variant="caption"
                            sx={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'block',
                            }}
                          >
                            {execution.exitMessage || 'N/A'}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </InfoCard>
      </Content>
    </Page>
  );
};
