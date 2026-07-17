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
  Box,
  FormControl,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { springBatchApiRef } from '../../api';
import { useEnvironmentSelector, usePagination } from '../../hooks';
import type { JobInstanceWithStats } from '../../types';
import { formatDateWithTimezone } from '../../utils/formatters';
import {
  BootVersionChip,
  EnvironmentSelector,
  FilterSelect,
  StatisticsCard,
  StatusChip,
  TablePaginationControls,
} from '../common';

export const JobInstancesPage = () => {
  const navigate = useNavigate();
  const api = useApi(springBatchApiRef);

  const { environment, setEnvironment } = useEnvironmentSelector();

  const [instances, setInstances] = useState<JobInstanceWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [jobNameFilter, setJobNameFilter] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');

  // biome-ignore lint/correctness/useExhaustiveDependencies: environment is the only dependency that should trigger the effect
  useEffect(() => {
    fetchData();
  }, [environment]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await api.getJobInstancesWithStats(environment);
      setInstances(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch job instances');
    } finally {
      setLoading(false);
    }
  };

  const uniqueJobNames = useMemo(
    () => Array.from(new Set(instances.map(i => i.jobName))).sort(),
    [instances],
  );

  const filteredInstances = useMemo(() => {
    return instances.filter(instance => {
      const matchesJobName =
        !jobNameFilter || instance.jobName === jobNameFilter;
      const matchesSearch =
        !searchText ||
        instance.jobInstanceId.toString().includes(searchText) ||
        instance.jobName.toLowerCase().includes(searchText.toLowerCase()) ||
        instance.jobKey.toLowerCase().includes(searchText.toLowerCase());
      return matchesJobName && matchesSearch;
    });
  }, [instances, jobNameFilter, searchText]);

  const {
    state: { page, pageSize },
    controls: { goToPage, setPageSize },
    paginatedData,
  } = usePagination(filteredInstances);

  const handleRowClick = (instanceId: number, bootVersion?: string) => {
    const bootVersionParam = bootVersion
      ? `&bootVersion=${encodeURIComponent(bootVersion)}`
      : '';
    navigate(
      `/spring-batch/instances/${instanceId}/history?environment=${environment}${bootVersionParam}`,
    );
  };

  if (loading && instances.length === 0) {
    return (
      <Page themeId="tool">
        <Header
          title="Job Instances"
          subtitle="Browse all Spring Batch job instances"
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
        title="Job Instances"
        subtitle="Browse all Spring Batch job instances"
      />
      <Content>
        {error && (
          <Box mb={3} color="error.main">
            Error: {error}
          </Box>
        )}

        {/* Environment Selector */}
        <EnvironmentSelector
          value={environment}
          onChange={setEnvironment}
          loading={loading}
        />

        {/* Statistics Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid item xs={12} sm={6} md={4}>
            <StatisticsCard
              value={filteredInstances.length}
              label="Total Instances"
              type="primary"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatisticsCard
              value={uniqueJobNames.length}
              label="Unique Jobs"
              type="info"
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <StatisticsCard
              value={instances.reduce((sum, i) => sum + i.executionCount, 0)}
              label="Total Executions"
              type="secondary"
            />
          </Grid>
        </Grid>

        {/* Instances Table */}
        <InfoCard title={`Job Instances (${filteredInstances.length})`}>
          {/* Filters */}
          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2}>
              <Grid item>
                <FilterSelect
                  label="Job Name"
                  value={jobNameFilter}
                  onChange={setJobNameFilter}
                  options={uniqueJobNames}
                />
              </Grid>
              <Grid item>
                <FormControl sx={{ minWidth: 300 }}>
                  <TextField
                    label="Search"
                    placeholder="Search by ID, name, or key"
                    value={searchText}
                    onChange={e => setSearchText(e.target.value)}
                    variant="outlined"
                    fullWidth
                  />
                </FormControl>
              </Grid>
            </Grid>
          </Box>

          {/* Table */}
          {paginatedData.length > 0 ? (
            <>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ minWidth: 100 }}>Instance ID</TableCell>
                    <TableCell>Job Name</TableCell>
                    <TableCell>Job Key</TableCell>
                    <TableCell align="center">Boot Version</TableCell>
                    <TableCell align="right">Executions</TableCell>
                    <TableCell align="center">Last Status</TableCell>
                    <TableCell>Last Execution Time</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {paginatedData.map(instance => (
                    <TableRow
                      key={instance.jobInstanceId}
                      hover
                      sx={{
                        cursor: 'pointer',
                        '&:hover': { backgroundColor: 'action.hover' },
                      }}
                      onClick={() =>
                        handleRowClick(
                          instance.jobInstanceId,
                          instance.bootVersion,
                        )
                      }
                    >
                      <TableCell sx={{ minWidth: 100 }}>
                        <Typography
                          variant="body2"
                          color="primary"
                          sx={{ fontWeight: 500 }}
                        >
                          {instance.jobInstanceId}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {instance.jobName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={instance.jobKey}>
                          <Typography
                            variant="body2"
                            color="textSecondary"
                            noWrap
                            sx={{ maxWidth: 150 }}
                          >
                            {instance.jobKey}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell align="center">
                        <BootVersionChip bootVersion={instance.bootVersion} />
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2">
                          {instance.executionCount}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <StatusChip status={instance.lastExecutionStatus} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="textSecondary">
                          {formatDateWithTimezone(
                            instance.lastExecutionTime,
                            environment,
                          )}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              <TablePaginationControls
                count={filteredInstances.length}
                page={page}
                rowsPerPage={pageSize}
                onPageChange={goToPage}
                onRowsPerPageChange={setPageSize}
              />
            </>
          ) : (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography color="textSecondary">
                No job instances found
              </Typography>
            </Box>
          )}
        </InfoCard>
      </Content>
    </Page>
  );
};
