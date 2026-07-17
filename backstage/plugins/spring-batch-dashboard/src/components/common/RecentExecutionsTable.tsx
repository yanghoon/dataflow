import { InfoCard } from '@backstage/core-components';
import { useApi, useRouteRef } from '@backstage/core-plugin-api';
import { executionDetailRouteRef } from '../../routes';
import { Box, Grid, Typography } from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { springBatchApiRef } from '../../api';
import { usePagination } from '../../hooks';
import type {
  Environment,
  JobExecution,
  JobExecutionQuery,
  JobStatus,
} from '../../types';
import { BOOT_VERSIONS, JOB_STATUSES } from '../../utils';
import { FilterSelect, TablePaginationControls } from '.';
import { ExecutionList } from '../ExecutionList';

interface RecentExecutionsTableProps {
  environment: Environment;
  fromISO?: string | null;
  toISO?: string | null;
  bootVersionFilter: 'Boot3' | 'Boot4' | '';
  onBootVersionChange: (value: 'Boot3' | 'Boot4' | '') => void;
  showPagination?: boolean;
  executions?: JobExecution[];
}

export const RecentExecutionsTable = ({
  environment,
  fromISO,
  toISO,
  bootVersionFilter,
  onBootVersionChange,
  showPagination = true,
  executions, // External data
}: RecentExecutionsTableProps) => {
  const navigate = useNavigate();
  const api = useApi(springBatchApiRef);
  const detailLink = useRouteRef(executionDetailRouteRef);

  const [loading, setLoading] = useState(true);
  const [allExecutions, setAllExecutions] = useState<JobExecution[]>([]);
  const [filteredExecutions, setFilteredExecutions] = useState<JobExecution[]>(
    [],
  );

  const [statusFilter, setStatusFilter] = useState<JobStatus | ''>('');
  const [jobNameFilter, setJobNameFilter] = useState('');

  // biome-ignore lint/correctness/useExhaustiveDependencies: environment is the only dependency that should trigger the effect
  useEffect(() => {
    if (executions) {
      setAllExecutions(executions);
      setLoading(false);
    } else {
      fetchExecutions();
    }
  }, [environment, fromISO, toISO, bootVersionFilter, executions]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: environment is the only dependency that should trigger the effect
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
    } catch (err: any) {
      console.error('Failed to fetch executions:', err);
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
    const link = detailLink({ id: execution.jobExecutionId.toString() });
    navigate(
      `${link}?environment=${environment}${bootVersionParam}`,
    );
  };

  const {
    state: { page, pageSize },
    controls: { goToPage, setPageSize },
    paginatedData,
  } = usePagination(filteredExecutions);

  const uniqueJobNames = useMemo(
    () =>
      Array.from(
        new Set(allExecutions.map(e => e.jobName).filter(Boolean)),
      ).sort() as string[],
    [allExecutions],
  );

  return (
    <InfoCard title={`Recent Executions (${filteredExecutions.length})`}>
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
                onBootVersionChange(value as 'Boot3' | 'Boot4' | '')
              }
              options={BOOT_VERSIONS}
            />
          </Grid>
        </Grid>
      </Box>

      {/* Execution List */}
      {showPagination && paginatedData.length > 0 ? (
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
        <ExecutionList
          executions={filteredExecutions}
          onRowClick={handleRowClick}
          environment={environment}
        />
      )}

      {filteredExecutions.length === 0 && !loading && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography color="textSecondary">
            No job executions found for the selected filters
          </Typography>
        </Box>
      )}
    </InfoCard>
  );
};
