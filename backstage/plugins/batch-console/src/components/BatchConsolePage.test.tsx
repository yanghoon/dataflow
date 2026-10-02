import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BatchConsolePage } from './BatchConsolePage';
import { TestApiProvider, wrapInTestApp } from '@backstage/test-utils';
import { batchConsoleApiRef } from '../api/BatchConsoleApi';
import { alertApiRef } from '@backstage/core-plugin-api';

const mockApi = {
  getJobNames: jest.fn().mockResolvedValue(['testJob1', 'testJob2']),
  getJobs: jest.fn().mockResolvedValue([
    {
      name: 'testJob1',
      restartable: true,
      hasSchema: false,
      totalExecutions: 5,
      lastStatus: 'COMPLETED',
      lastExecutionTime: null,
    },
    {
      name: 'testJob2',
      restartable: false,
      hasSchema: true,
      totalExecutions: 2,
      lastStatus: 'FAILED',
      lastExecutionTime: null,
    },
  ]),
  getJobSchema: jest.fn().mockResolvedValue(null),
  runJob: jest.fn().mockResolvedValue({ executionId: 101 }),
  getSchedules: jest.fn().mockResolvedValue([
    {
      id: 'sched-1',
      jobName: 'testJob1',
      cronExpression: '0 0 * * * *',
      parameters: { key1: 'val1' },
      createdAt: '2026-10-01T00:00:00Z',
      lastExecutionTime: '2026-10-02T00:00:00Z',
      lastStatus: 'SUCCESS',
    },
  ]),
  createSchedule: jest.fn().mockResolvedValue({ id: 'sched-2' }),
  updateSchedule: jest.fn().mockResolvedValue(undefined),
  cancelSchedule: jest.fn().mockResolvedValue(undefined),
};

const mockAlertApi = {
  post: jest.fn(),
};

describe('BatchConsolePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Scheduled tab by default with Create button', async () => {
    render(
      wrapInTestApp(
        <TestApiProvider
          apis={[
            [batchConsoleApiRef, mockApi],
            [alertApiRef, mockAlertApi],
          ]}
        >
          <BatchConsolePage />
        </TestApiProvider>
      )
    );

    // ButtonGroup tab buttons
    expect(screen.getByRole('button', { name: 'Scheduled' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Jobs' })).toBeInTheDocument();

    // Create button should be visible in Scheduled tab
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument();

    // Scheduled content rendered
    await waitFor(() => {
      expect(screen.getByText('Scheduled Jobs')).toBeInTheDocument();
      expect(screen.getByText('testJob1')).toBeInTheDocument();
    });
  });

  it('switches to Jobs tab on button click and hides Create button', async () => {
    render(
      wrapInTestApp(
        <TestApiProvider
          apis={[
            [batchConsoleApiRef, mockApi],
            [alertApiRef, mockAlertApi],
          ]}
        >
          <BatchConsolePage />
        </TestApiProvider>
      )
    );

    const jobsTabBtn = screen.getByRole('button', { name: 'Jobs' });
    fireEvent.click(jobsTabBtn);

    // Create button must NOT be present in Jobs tab
    expect(screen.queryByRole('button', { name: 'Create' })).not.toBeInTheDocument();

    // BatchJobsView content rendered
    await waitFor(() => {
      expect(screen.getByText('Spring Batch Jobs (2)')).toBeInTheDocument();
      expect(screen.getByText('testJob1')).toBeInTheDocument();
      expect(screen.getByText('testJob2')).toBeInTheDocument();
    });
  });
});
