export type SettingType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'SELECT';
export interface SettingOption { label: string; value: string; }
export interface SettingItem {
  key: string;
  type: SettingType;
  label: string;
  description?: string;
  value: any;
  options?: SettingOption[];
  group?: string;
}
export type DirtySettingItem = SettingItem & { isDirty: boolean; originalValue: any; };
