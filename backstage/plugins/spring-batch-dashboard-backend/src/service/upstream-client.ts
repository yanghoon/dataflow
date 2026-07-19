import type { Config } from '@backstage/config';
import type { LoggerService } from '@backstage/backend-plugin-api';

export class UpstreamClient {
  private readonly config: Config;
  private readonly logger: LoggerService;

  constructor(options: { config: Config; logger: LoggerService }) {
    this.config = options.config;
    this.logger = options.logger;
  }

  private getUpstreamConfig(environment: string) {
    const configPath = `springBatch.databases.${environment}.http`;
    const url = this.config.getOptionalString(`${configPath}.url`);
    
    let headers: Record<string, string> = {};
    if (this.config.has(`${configPath}.headers`)) {
      const headersConfig = this.config.getOptionalConfig(`${configPath}.headers`);
      if (headersConfig) {
        const keys = headersConfig.keys();
        for (const key of keys) {
          headers[key] = headersConfig.getString(key);
        }
      }
    }

    return { url, headers };
  }

  async getJobNames(environment: string): Promise<any[]> {
    const { url, headers } = this.getUpstreamConfig(environment);
    const defaultJob = [{ jobName: 'httpJob', displayName: 'HTTP Job' }];

    this.logger.info(`!!!!! ${url}, ${headers}`)

    if (!url) {
      return defaultJob;
    }

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      });
      
      if (!response.ok) {
        this.logger.warn(`Failed to fetch job names from upstream: ${response.status} ${response.statusText}`);
        return defaultJob;
      }

      const data: string[] = await response.json();
      return data.map(jobName => ({ jobName, displayName: jobName }));
    } catch (error: any) {
      this.logger.warn(`Error fetching job names from upstream via HTTP API: ${error.message}`);
      return defaultJob;
    }
  }

  async executeJob(environment: string, jobName: string, jobParams: Record<string, string>): Promise<any> {
    const { url, headers } = this.getUpstreamConfig(environment);

    if (!url) {
      throw new Error(`HTTP API URL (springBatch.databases.${environment}.http.url) is not configured`);
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify({
        jobName,
        jobParams,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to execute job: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json().catch(() => ({}));
    return data;
  }
}
