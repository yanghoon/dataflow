import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BatchJobsView } from './BatchJobsView';
import { TestApiProvider, wrapInTestApp } from '@backstage/test-utils';
import { batchConsoleApiRef } from '../api/BatchConsoleApi';
import { alertApiRef } from '@backstage/core-plugin-api';

const mockApi = {
  getEnvironments: jest.fn().mockResolvedValue({ environments: ['dev'], defaultEnvironment: 'dev' }),
  getJobNames: jest.fn().mockResolvedValue(['job1', 'job2']),
  getJobs: jest.fn().mockResolvedValue([
    {
      name: 'job1',
      restartable: true,
      hasSchema: false,
      totalExecutions: 5,
      lastStatus: 'COMPLETED',
      lastExecutionTime: '2026-10-01T12:00:00Z',
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
  getJobSchema: jest.fn().mockResolvedValue(null),
  runJob: jest.fn().mockResolvedValue({ executionId: 201 }),
  getSchedules: jest.fn().mockResolvedValue([]),
  createSchedule: jest.fn(),
  updateSchedule: jest.fn(),
  cancelSchedule: jest.fn(),
};

const mockAlertApi = {
  post: jest.fn(),
};

describe('BatchJobsView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Job Name as plain text without link', async () => {
    render(
      wrapInTestApp(
        <TestApiProvider
          apis={[
            [batchConsoleApiRef, mockApi],
            [alertApiRef, mockAlertApi],
          ]}
        >
          <BatchJobsView />
        </TestApiProvider>
      )
    );

    await waitFor(() => {
      expect(screen.getByText('Spring Batch Jobs (2)')).toBeInTheDocument();
      expect(screen.getByText('job1')).toBeInTheDocument();
      expect(screen.getByText('job2')).toBeInTheDocument();
    });

    const job1Cell = screen.getByText('job1');
    expect(job1Cell.closest('a')).toBeNull();
  });

  it('passes environment to getJobs when provided', async () => {
    render(
      wrapInTestApp(
        <TestApiProvider
          apis={[
            [batchConsoleApiRef, mockApi],
            [alertApiRef, mockAlertApi],
          ]}
        >
          <BatchJobsView environment="dev" />
        </TestApiProvider>
      )
    );

    await waitFor(() => {
      expect(mockApi.getJobs).toHaveBeenCalledWith('dev');
    });
  });

  it('opens RunJobDialog when Run button is clicked', async () => {
    render(
      wrapInTestApp(
        <TestApiProvider
          apis={[
            [batchConsoleApiRef, mockApi],
            [alertApiRef, mockAlertApi],
          ]}
        >
          <BatchJobsView environment="dev" />
        </TestApiProvider>
      )
    );

    await waitFor(() => {
      expect(screen.getByText('job1')).toBeInTheDocument();
    });

    const runBtn = screen.getByRole('button', { name: 'Run job1' });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByText('Run Job: job1')).toBeInTheDocument();
    });

    const keyInput = screen.getByPlaceholderText('e.g. date');
    const valueInput = screen.getByPlaceholderText('e.g. 2026-10-02');
    fireEvent.change(keyInput, { target: { value: 'param1' } });
    fireEvent.change(valueInput, { target: { value: 'val1' } });

    const dialogRunBtn = screen.getByRole('button', { name: 'Run' });
    fireEvent.click(dialogRunBtn);

    await waitFor(() => {
      expect(mockApi.runJob).toHaveBeenCalledWith('job1', { param1: 'val1' }, 'dev');
      expect(mockAlertApi.post).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success' })
      );
    });
  });

  it('renders History button with link to /spring-batch', async () => {
    render(
      wrapInTestApp(
        <TestApiProvider
          apis={[
            [batchConsoleApiRef, mockApi],
            [alertApiRef, mockAlertApi],
          ]}
        >
          <BatchJobsView />
        </TestApiProvider>
      )
    );

    await waitFor(() => {
      expect(screen.getByText('job1')).toBeInTheDocument();
    });

    const historyLinks = screen.getAllByLabelText('View History');
    expect(historyLinks[0]).toHaveAttribute('href', '/spring-batch');
  });
});
