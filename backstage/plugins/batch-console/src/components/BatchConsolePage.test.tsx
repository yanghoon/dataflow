import { render, screen, waitFor } from '@testing-library/react';
import { BatchConsolePage } from './BatchConsolePage';
import { TestApiProvider, wrapInTestApp } from '@backstage/test-utils';
import { batchConsoleApiRef } from '../api/BatchConsoleApi';
import { jobRunRouteRef } from '../routes';

const mockApi = {
  getJobNames: jest.fn().mockResolvedValue(['job1', 'job2']),
  getJobSchema: jest.fn(),
  runJob: jest.fn(),
};

describe('BatchConsolePage', () => {
  it('renders job names', async () => {
    render(
      wrapInTestApp(
        <TestApiProvider apis={[[batchConsoleApiRef, mockApi]]}>
          <BatchConsolePage />
        </TestApiProvider>,
        {
          mountedRoutes: { '/platform/batch/jobs/:jobName': jobRunRouteRef },
        }
      )
    );

    await waitFor(() => {
      expect(screen.getByText('job1')).toBeInTheDocument();
      expect(screen.getByText('job2')).toBeInTheDocument();
    });
  });
});
