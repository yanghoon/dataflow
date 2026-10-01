import { createApiRef, DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';

export interface BatchConsoleApi {
  getJobNames(): Promise<string[]>;
  getJobSchema(jobName: string): Promise<any>;
  runJob(jobName: string, params: Record<string, any>): Promise<{ executionId: number }>;
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

  async getJobNames(): Promise<string[]> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/jobs`);
    if (!response.ok) throw new Error(`Failed to fetch job names: ${response.statusText}`);
    return await response.json();
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
}
