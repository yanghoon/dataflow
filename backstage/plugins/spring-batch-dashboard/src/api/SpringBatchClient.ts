import type { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import type {
  DailyJobSummary,
  DailyStatistics,
  DailyTrendData,
  Environment,
  JobExecution,
  JobExecutionQuery,
  JobInstance,
  JobInstanceWithStats,
  JobStatistics,
  StepExecution,
} from '../types';

export class SpringBatchClient {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  private async getBaseUrl(): Promise<string> {
    return await this.discoveryApi.getBaseUrl('spring-batch-dashboard');
  }

  async getEnvironments(): Promise<{
    environments: string[];
    defaultEnvironment: string;
  }> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/environments`);

    if (!response.ok) {
      throw new Error(`Failed to fetch environments: ${response.statusText}`);
    }

    return await response.json();
  }

  async getStatistics(environment?: Environment): Promise<JobStatistics> {
    const baseUrl = await this.getBaseUrl();
    const params = new URLSearchParams();
    if (environment) params.append('environment', environment);

    const url = `${baseUrl}/statistics${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.fetchApi.fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch statistics: ${response.statusText}`);
    }

    return await response.json();
  }

  async getExecutions(
    query?: JobExecutionQuery,
    environment?: Environment,
    bootVersion?: 'Boot3' | 'Boot4' | 'Default',
  ): Promise<JobExecution[]> {
    const baseUrl = await this.getBaseUrl();
    const params = new URLSearchParams();

    if (query) {
      if (query.limit !== undefined)
        params.append('limit', query.limit.toString());
      if (query.offset !== undefined)
        params.append('offset', query.offset.toString());
      if (query.status) params.append('status', query.status);
      if (query.jobName) params.append('jobName', query.jobName);
      if (query.from) params.append('from', query.from);
      if (query.to) params.append('to', query.to);
    }

    if (environment) params.append('environment', environment);
    if (bootVersion) params.append('bootVersion', bootVersion);

    const url = `${baseUrl}/executions${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.fetchApi.fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch executions: ${response.statusText}`);
    }

    return await response.json();
  }

  async getExecutionDetail(
    id: number,
    environment?: Environment,
    bootVersion?: 'Boot3' | 'Boot4' | 'Default',
  ): Promise<JobExecution> {
    const baseUrl = await this.getBaseUrl();
    const params = new URLSearchParams();
    if (environment) params.append('environment', environment);
    if (bootVersion) params.append('bootVersion', bootVersion);

    const url = `${baseUrl}/executions/${id}${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.fetchApi.fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch execution detail: ${response.statusText}`,
      );
    }

    return await response.json();
  }

  async getStepDetail(
    id: number,
    environment?: Environment,
    bootVersion?: 'Boot3' | 'Boot4' | 'Default',
  ): Promise<StepExecution> {
    const baseUrl = await this.getBaseUrl();
    const params = new URLSearchParams();
    if (environment) params.append('environment', environment);
    if (bootVersion) params.append('bootVersion', bootVersion);

    const url = `${baseUrl}/steps/${id}${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.fetchApi.fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch step detail: ${response.statusText}`);
    }

    return await response.json();
  }

  async getJobs(environment?: Environment): Promise<JobInstance[]> {
    const baseUrl = await this.getBaseUrl();
    const params = new URLSearchParams();
    if (environment) params.append('environment', environment);

    const url = `${baseUrl}/jobs${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.fetchApi.fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch jobs: ${response.statusText}`);
    }

    return await response.json();
  }

  async getJobInstancesWithStats(
    environment?: Environment,
  ): Promise<JobInstanceWithStats[]> {
    const baseUrl = await this.getBaseUrl();
    const params = new URLSearchParams({ includeStats: 'true' });
    if (environment) params.append('environment', environment);

    const url = `${baseUrl}/jobs?${params.toString()}`;
    const response = await this.fetchApi.fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch job instances with stats: ${response.statusText}`,
      );
    }

    return await response.json();
  }

  async getJobExecutions(
    name: string,
    limit?: number,
  ): Promise<JobExecution[]> {
    const baseUrl = await this.getBaseUrl();
    const params = new URLSearchParams();

    if (limit !== undefined) {
      params.append('limit', limit.toString());
    }

    const url = `${baseUrl}/jobs/${encodeURIComponent(name)}/executions${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.fetchApi.fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch job executions: ${response.statusText}`);
    }

    return await response.json();
  }

  async getJobExecutionsWithSteps(
    name: string,
    limit?: number,
  ): Promise<JobExecution[]> {
    const baseUrl = await this.getBaseUrl();
    const params = new URLSearchParams();

    if (limit !== undefined) {
      params.append('limit', limit.toString());
    }
    params.append('includeSteps', 'true');

    const url = `${baseUrl}/jobs/${encodeURIComponent(name)}/executions${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.fetchApi.fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch job executions with steps: ${response.statusText}`,
      );
    }

    return await response.json();
  }

  async getDailyStatistics(
    date: string,
    environment?: Environment,
  ): Promise<DailyStatistics> {
    const baseUrl = await this.getBaseUrl();
    const params = new URLSearchParams();
    if (environment) params.append('environment', environment);

    const url = `${baseUrl}/daily/${date}/statistics${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.fetchApi.fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch daily statistics: ${response.statusText}`,
      );
    }

    return await response.json();
  }

  async getDailyJobSummaries(
    date: string,
    environment?: Environment,
  ): Promise<DailyJobSummary[]> {
    const baseUrl = await this.getBaseUrl();
    const params = new URLSearchParams();
    if (environment) params.append('environment', environment);

    const url = `${baseUrl}/daily/${date}/jobs${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.fetchApi.fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch daily job summaries: ${response.statusText}`,
      );
    }

    return await response.json();
  }

  async getTrendData(
    fromDate: string,
    toDate: string,
    environment?: Environment,
  ): Promise<DailyTrendData[]> {
    const baseUrl = await this.getBaseUrl();
    const params = new URLSearchParams({ from: fromDate, to: toDate });
    if (environment) params.append('environment', environment);

    const response = await this.fetchApi.fetch(
      `${baseUrl}/analytics/trend?${params.toString()}`,
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch trend data: ${response.statusText}`);
    }

    return await response.json();
  }

  async getJobInstanceExecutions(
    jobInstanceId: number,
    environment?: Environment,
    bootVersion?: 'Boot3' | 'Boot4' | 'Default',
  ): Promise<JobExecution[]> {
    const baseUrl = await this.getBaseUrl();
    const params = new URLSearchParams();
    if (environment) params.append('environment', environment);
    if (bootVersion) params.append('bootVersion', bootVersion);

    const url = `${baseUrl}/instances/${jobInstanceId}/executions${params.toString() ? `?${params.toString()}` : ''}`;
    const response = await this.fetchApi.fetch(url);

    if (!response.ok) {
      throw new Error(
        `Failed to fetch job instance executions: ${response.statusText}`,
      );
    }

    return await response.json();
  }
}
