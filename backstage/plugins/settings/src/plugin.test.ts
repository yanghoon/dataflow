import { settingsPlugin } from './plugin';

describe('settings', () => {
  it('should export plugin', () => {
    expect(settingsPlugin).toBeDefined();
  });
});
