import { createApiRef } from '@backstage/core-plugin-api';
import { SettingItem } from './types';

export const settingsApiRef = createApiRef<SettingsApi>({
  id: 'plugin.settings.service',
});

export interface SettingsApi {
  getConfigs(): Promise<SettingItem[]>;
  updateConfigs(items: SettingItem[]): Promise<void>;
  addConfig(item: SettingItem): Promise<void>;
}
