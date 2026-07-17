import React from 'react';
import {
  Content,
  Header,
  InfoCard,
  Page,
  Progress,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { Box, Grid, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { springBatchApiRef } from '../../api';
import {
  useDateRange,
  useEnvironmentSelector,
  usePagination,
} from '../../hooks';
import type { JobExecution, JobExecutionQuery, JobStatus } from '../../types';
import { BOOT_VERSIONS, JOB_STATUSES } from '../../utils';
import {
  DateRangeSelector,
  EnvironmentSelector,
  FilterSelect,
  StatisticsCard,
  TablePaginationControls,
} from '../common';
import { ExecutionList } from '../ExecutionList';

export const JobExecutionsPage = () => {
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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [allExecutions, setAllExecutions] = useState<JobExecution[]>([]); // For statistics
  const [filteredExecutions, setFilteredExecutions] = useState<JobExecution[]>(
    [],
  ); // For table

  const [statusFilter, setStatusFilter] = useState<JobStatus | ''>('');
  const [jobNameFilter, setJobNameFilter] = useState('');
  const [bootVersionFilter, setBootVersionFilter] = useState<
    'Boot3' | 'Boot4' | ''
  >('');

  // biome-ignore lint/correctness/useExhaustiveDependencies: environment is the only dependency that should trigger the effect
  useEffect(() => {
    fetchExecutions();
  }, [environment, fromDate, toDate, bootVersionFilter]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: statusFilter, jobNameFilter, allExecutions are the only dependencies that should trigger the effect
  useEffect(() => {
    filterExecutions();
  }, [statusFilter, jobNameFilter, allExecutions]);

  const fetchExecutions = async () => {
    try {
      setLoading(true);

      const query: JobExecutionQuery = {
        limit: 1000,
        offset: 0,
        from: fromISO || undefined,
        to: toISO || undefined,
      };

      const result = await api.getExecutions(
        query,
        environment,
        bootVersionFilter || undefined,
      );
      setAllExecutions(result);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch executions');
    } finally {
      setLoading(false);
    }
  };

  const filterExecutions = () => {
    let filtered = [...allExecutions];

    if (statusFilter) {
      filtered = filtered.filter(e => e.status && e.status === statusFilter);
    }

    if (jobNameFilter) {
      filtered = filtered.filter(e => e.jobName && e.jobName === jobNameFilter);
    }

    setFilteredExecutions(filtered);
  };

  const handleRowClick = (execution: JobExecution) => {
    const bootVersionParam = execution.bootVersion
      ? `&bootVersion=${encodeURIComponent(execution.bootVersion)}`
      : '';
    navigate(
      `/spring-batch/executions/${execution.jobExecutionId}?environment=${environment}${bootVersionParam}`,
    );
  };

  const {
    state: { page, pageSize },
    controls: { goToPage, setPageSize },
    paginatedData,
  } = usePagination(filteredExecutions);

  const stats = useMemo(
    () => ({
      total: allExecutions.length,
      completed: allExecutions.filter(e => e.status === 'COMPLETED').length,
      failed: allExecutions.filter(e => e.status === 'FAILED').length,
      started: allExecutions.filter(e => e.status === 'STARTED').length,
    }),
    [allExecutions],
  );

  const uniqueJobNames = useMemo(
    () =>
      Array.from(
        new Set(allExecutions.map(e => e.jobName).filter(Boolean)),
      ).sort() as string[],
    [allExecutions],
  );

  if (loading && allExecutions.length === 0) {
    return (
      <Page themeId="tool">
        <Header
          title="Job Executions"
          subtitle="Browse all Spring Batch job executions"
        />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  if (error && allExecutions.length === 0) {
    return (
      <Page themeId="tool">
        <Header
          title="Job Executions"
          subtitle="Browse all Spring Batch job executions"
        />
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
      <Header
        title="Job Executions"
        subtitle="Browse all Spring Batch job executions"
      />
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

        {/* Executions Table */}
        <InfoCard title={`Job Executions (${filteredExecutions.length})`}>
          {/* Filters */}
          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2}>
              <Grid item>
                <FilterSelect
                  label="Status"
                  value={statusFilter}
                  onChange={value => setStatusFilter(value as JobStatus | '')}
                  options={JOB_STATUSES}
                />
              </Grid>
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

          {/* Execution List */}
          {paginatedData.length > 0 ? (
            <>
              <ExecutionList
                executions={paginatedData}
                onRowClick={handleRowClick}
                environment={environment}
              />

              {/* Pagination Controls */}
              <TablePaginationControls
                count={filteredExecutions.length}
                page={page}
                rowsPerPage={pageSize}
                onPageChange={goToPage}
                onRowsPerPageChange={setPageSize}
              />
            </>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="textSecondary">
                No job executions found for the selected filters
              </Typography>
            </Box>
          )}
        </InfoCard>
      </Content>
    </Page>
  );
};
