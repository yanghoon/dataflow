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
  getJobNames(): Promise<string[]>;
  getJobs(): Promise<BatchJobItem[]>;
  getJobSchema(jobName: string): Promise<any>;
  runJob(jobName: string, params: Record<string, any>): Promise<{ executionId: number }>;
  getSchedules(): Promise<ScheduleItem[]>;
  createSchedule(jobName: string, cronExpression: string, parameters: Record<string, any>): Promise<{ id: string }>;
  updateSchedule(id: string, jobName: string, cronExpression: string, parameters: Record<string, any>): Promise<void>;
  cancelSchedule(id: string): Promise<void>;
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
    return `${await this.discoveryApi.getBaseUrl('proxy')}/spring-batch/api/batch`;
  }

  async getJobs(): Promise<BatchJobItem[]> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/jobs`);
    if (!response.ok) throw new Error(`Failed to fetch jobs: ${response.statusText}`);
    return await response.json();
  }

  async getJobNames(): Promise<string[]> {
    const jobs = await this.getJobs();
    return jobs.map(j => (typeof j === 'string' ? j : j.name));
  }

  async getJobSchema(jobName: string): Promise<any> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/jobs/${jobName}/schema`);
    if (response.status === 204) {
      return null;
    }
    if (!response.ok) throw new Error(`Failed to fetch job schema: ${response.statusText}`);
    return await response.json();
  }

  async runJob(jobName: string, params: Record<string, any>): Promise<{ executionId: number }> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/jobs/${jobName}/executions`, {
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

  
  async getSchedules(): Promise<any[]> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/schedules`);
    if (!response.ok) throw new Error(`Failed to fetch schedules: ${response.statusText}`);
    return await response.json();
  }

  async createSchedule(jobName: string, cronExpression: string, parameters: Record<string, any>): Promise<{ id: string }> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/schedules`, {
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

  async updateSchedule(id: string, jobName: string, cronExpression: string, parameters: Record<string, any>): Promise<void> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/schedules/${id}`, {
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

  async cancelSchedule(id: string): Promise<void> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/schedules/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error(`Failed to cancel schedule: ${response.statusText}`);
  }
}
