import { createApiRef, DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';

export interface ScheduleItem {
  id: string;
  jobName: string;
  cronExpression: string;
  parameters: Record<string, string>;
  createdAt?: string | null;
  lastExecutionTime?: string | null;
  lastStatus?: 'SUCCESS' | 'FAILED' | 'RUNNING' | null;
}

export interface BatchJobItem {
  name: string;
  restartable: boolean;
  hasSchema: boolean;
  totalExecutions: number;
  lastStatus?: 'COMPLETED' | 'FAILED' | 'STARTED' | null;
  lastExecutionTime?: string | null;
}

export interface BatchConsoleApi {
  getEnvironments(): Promise<{ environments: string[]; defaultEnvironment: string }>;
  getJobNames(environment?: string): Promise<string[]>;
  getJobs(environment?: string): Promise<BatchJobItem[]>;
  getJobSchema(jobName: string, environment?: string): Promise<any>;
  runJob(jobName: string, params: Record<string, any>, environment?: string): Promise<{ executionId: number }>;
  getSchedules(environment?: string): Promise<ScheduleItem[]>;
  createSchedule(jobName: string, cronExpression: string, parameters: Record<string, any>, environment?: string): Promise<{ id: string }>;
  updateSchedule(id: string, jobName: string, cronExpression: string, parameters: Record<string, any>, environment?: string): Promise<void>;
  cancelSchedule(id: string, environment?: string): Promise<void>;
}

export const batchConsoleApiRef = createApiRef<BatchConsoleApi>({
  id: 'plugin.batch-console.service',
});

export class BatchConsoleApiClient implements BatchConsoleApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  private async getBaseUrl() {
    return await this.discoveryApi.getBaseUrl('batch-console');
  }

  private getEnvQuery(environment?: string): string {
    return environment ? `?environment=${encodeURIComponent(environment)}` : '';
  }

  async getEnvironments(): Promise<{ environments: string[]; defaultEnvironment: string }> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/environments`);
    if (!response.ok) throw new Error(`Failed to fetch environments: ${response.statusText}`);
    return await response.json();
  }

  async getJobs(environment?: string): Promise<BatchJobItem[]> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/jobs${this.getEnvQuery(environment)}`);
    if (!response.ok) throw new Error(`Failed to fetch jobs: ${response.statusText}`);
    return await response.json();
  }

  async getJobNames(environment?: string): Promise<string[]> {
    const jobs = await this.getJobs(environment);
    return jobs.map(j => (typeof j === 'string' ? j : j.name));
  }

  async getJobSchema(jobName: string, environment?: string): Promise<any> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/jobs/${jobName}/schema${this.getEnvQuery(environment)}`);
    if (response.status === 204) {
      return null;
    }
    if (!response.ok) throw new Error(`Failed to fetch job schema: ${response.statusText}`);
    return await response.json();
  }

  async runJob(jobName: string, params: Record<string, any>, environment?: string): Promise<{ executionId: number }> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/jobs/${jobName}/executions${this.getEnvQuery(environment)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    
    if (!response.ok) {
        let errorMsg = response.statusText;
        try {
            const errorData = await response.json();
            if (errorData.error) errorMsg = errorData.error;
        } catch(e) {}
        throw new Error(errorMsg);
    }
    
    return await response.json();
  }

  async getSchedules(environment?: string): Promise<any[]> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/schedules${this.getEnvQuery(environment)}`);
    if (!response.ok) throw new Error(`Failed to fetch schedules: ${response.statusText}`);
    return await response.json();
  }

  async createSchedule(jobName: string, cronExpression: string, parameters: Record<string, any>, environment?: string): Promise<{ id: string }> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/schedules${this.getEnvQuery(environment)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobName, cronExpression, parameters }),
    });
    
    if (!response.ok) {
        let errorMsg = response.statusText;
        try {
            const errorData = await response.json();
            if (errorData.error) errorMsg = errorData.error;
        } catch(e) {}
        throw new Error(errorMsg);
    }
    
    return await response.json();
  }

  async updateSchedule(id: string, jobName: string, cronExpression: string, parameters: Record<string, any>, environment?: string): Promise<void> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/schedules/${id}${this.getEnvQuery(environment)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jobName, cronExpression, parameters }),
    });
    
    if (!response.ok) {
        let errorMsg = response.statusText;
        try {
            const errorData = await response.json();
            if (errorData.error) errorMsg = errorData.error;
        } catch(e) {}
        throw new Error(errorMsg);
    }
  }

  async cancelSchedule(id: string, environment?: string): Promise<void> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/schedules/${id}${this.getEnvQuery(environment)}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(`Failed to cancel schedule: ${response.statusText}`);
  }
}
