
import { screen } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';
import { TestApiProvider, renderInTestApp } from '@backstage/test-utils';

import { setupServer } from 'msw/node';
import { rest } from 'msw';
import { settingsApiRef, SettingsApiClient } from '../../api';

const mockConfigs = [
  {
    key: 'batch.scheduler.enabled',
    type: 'BOOLEAN',
    label: 'Enable Scheduler',
    description: 'Enables or disables the batch scheduler',
    value: true,
  },
];

const server = setupServer(
  rest.get('http://proxy/api/platforms/configs', (_, res, ctx) => {
    return res(ctx.json(mockConfigs));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('SettingsPage integration', () => {
  const mockDiscoveryApi = {
    getBaseUrl: async (pluginId: string) => `http://${pluginId}`,
  };

  const mockFetchApi = {
    fetch: fetch,
  };

  const settingsApi = new SettingsApiClient({
    discoveryApi: mockDiscoveryApi as any,
    fetchApi: mockFetchApi as any,
  });

  const renderComponent = async () =>
    renderInTestApp(
      <TestApiProvider apis={[[settingsApiRef, settingsApi]]}>
        <SettingsPage />
      </TestApiProvider>
    );

  it('fetches and displays configs via API client', async () => {
    await renderComponent();
    expect(await screen.findByText('Enable Scheduler')).toBeInTheDocument();
  });
});
