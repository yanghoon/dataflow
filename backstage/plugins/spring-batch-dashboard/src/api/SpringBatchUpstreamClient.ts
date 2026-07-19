import type { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import type { Environment, JobNameInfo } from '../types';

export class SpringBatchUpstreamClient {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  private async getBaseUrl(): Promise<string> {
    return await this.discoveryApi.getBaseUrl('spring-batch-dashboard');
  }

  async getJobNames(environment?: Environment): Promise<JobNameInfo[]> {
    const baseUrl = await this.getBaseUrl();
    const params = new URLSearchParams();
    if (environment) params.append('environment', environment);

    const url = `${baseUrl}/job-names${params.toString() ? `?${params.toString()}` : ''}`;
    console.log('[SpringBatchUpstreamClient] getJobNames - Requesting URL:', url);
    const response = await this.fetchApi.fetch(url);
    console.log('[SpringBatchUpstreamClient] getJobNames - Response status:', response.status);

    if (!response.ok) {
      console.error('[SpringBatchUpstreamClient] getJobNames - Request failed:', response.statusText);
      throw new Error(
        `Failed to fetch job names: ${response.statusText}`,
      );
    }

    const data = await response.json();
    console.log('[SpringBatchUpstreamClient] getJobNames - Parsed Data:', data);
    return data;
  }

  async executeJob(
    jobName: string,
    jobParams: Record<string, string>,
    environment?: Environment,
  ): Promise<any> {
    const baseUrl = await this.getBaseUrl();
    const params = new URLSearchParams();
    if (environment) params.append('environment', environment);

    const url = `${baseUrl}/executions${params.toString() ? `?${params.toString()}` : ''}`;
    
    const response = await this.fetchApi.fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jobName,
        jobParams,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to execute job: ${response.statusText}`);
    }

    return await response.json();
  }
}
