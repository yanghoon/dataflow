import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import { SettingsApi } from './SettingsApi';
import { SettingItem } from './types';

export class SettingsApiClient implements SettingsApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  async getConfigs(): Promise<SettingItem[]> {
    const baseUrl = await this.discoveryApi.getBaseUrl('proxy');
    const response = await this.fetchApi.fetch(`${baseUrl}/api/platforms/configs`);
    if (!response.ok) {
      throw new Error(`Failed to fetch configs: ${response.statusText}`);
    }
    return await response.json();
  }

  async updateConfigs(items: SettingItem[]): Promise<void> {
    const baseUrl = await this.discoveryApi.getBaseUrl('proxy');
    const response = await this.fetchApi.fetch(`${baseUrl}/api/platforms/configs`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(items),
    });
    if (!response.ok) {
      throw new Error(`Failed to update configs: ${response.statusText}`);
    }
  }

  async addConfig(item: SettingItem): Promise<void> {
    const baseUrl = await this.discoveryApi.getBaseUrl('proxy');
    const response = await this.fetchApi.fetch(`${baseUrl}/api/platforms/configs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(item),
    });
    if (!response.ok) {
      throw new Error(`Failed to add config: ${response.statusText}`);
    }
  }
}
