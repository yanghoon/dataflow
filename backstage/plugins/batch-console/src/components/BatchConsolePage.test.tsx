import { render, screen, waitFor } from '@testing-library/react';
import { BatchConsolePage } from './BatchConsolePage';
import { TestApiProvider, wrapInTestApp } from '@backstage/test-utils';
import { batchConsoleApiRef } from '../api/BatchConsoleApi';
import { jobRunRouteRef } from '../routes';

const mockApi = {
  getJobNames: jest.fn().mockResolvedValue(['job1', 'job2']),
  getJobs: jest.fn().mockResolvedValue([
    {
      name: 'job1',
      restartable: true,
      hasSchema: false,
      totalExecutions: 5,
      lastStatus: 'COMPLETED',
      lastExecutionTime: null,
    },
    {
      name: 'job2',
      restartable: false,
      hasSchema: true,
      totalExecutions: 2,
      lastStatus: 'FAILED',
      lastExecutionTime: null,
    },
  ]),
  getJobSchema: jest.fn(),
  runJob: jest.fn(),
  getSchedules: jest.fn(),
  createSchedule: jest.fn(),
  updateSchedule: jest.fn(),
  cancelSchedule: jest.fn(),
};

describe('BatchConsolePage (alias)', () => {
  it('renders jobs via backward-compatible alias', async () => {
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
