import { render, screen, waitFor } from '@testing-library/react';
import { BatchJobsPage } from './BatchJobsPage';
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
      lastExecutionTime: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
    },
    {
      name: 'job2',
      restartable: false,
      hasSchema: true,
      totalExecutions: 2,
      lastStatus: 'FAILED',
      lastExecutionTime: '2026-08-01T10:00:00Z',
    },
  ]),
  getJobSchema: jest.fn(),
  runJob: jest.fn(),
  getSchedules: jest.fn(),
  createSchedule: jest.fn(),
  updateSchedule: jest.fn(),
  cancelSchedule: jest.fn(),
};

describe('BatchJobsPage', () => {
  it('renders rich metadata columns and action buttons', async () => {
    render(
      wrapInTestApp(
        <TestApiProvider apis={[[batchConsoleApiRef, mockApi]]}>
          <BatchJobsPage />
        </TestApiProvider>,
        {
          mountedRoutes: { '/platform/batch/jobs/:jobName': jobRunRouteRef },
        }
      )
    );

    await waitFor(() => {
      expect(screen.getByText('Spring Batch Jobs (2)')).toBeInTheDocument();
      expect(screen.getByText('job1')).toBeInTheDocument();
      expect(screen.getByText('job2')).toBeInTheDocument();
    });

    // Check table headers
    expect(screen.getByText('Job Name')).toBeInTheDocument();
    expect(screen.getByText('Restartable')).toBeInTheDocument();
    expect(screen.getByText('Total Runs')).toBeInTheDocument();
    expect(screen.getByText('Last Status')).toBeInTheDocument();
    expect(screen.getByText('Last Run')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();

    // Check row data
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('COMPLETED')).toBeInTheDocument();
    expect(screen.getByText('FAILED')).toBeInTheDocument();

    // Check action buttons: Run is a button (not link), History is a link
    const runBtn = screen.getByRole('button', { name: 'Run job1' });
    expect(runBtn).toBeInTheDocument();

    const historyLinks = screen.getAllByLabelText('View History');
    expect(historyLinks[0]).toHaveAttribute('href', '/spring-batch');
  });
});
