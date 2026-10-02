import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SchedulePage } from './SchedulePage';
import { TestApiProvider, wrapInTestApp } from '@backstage/test-utils';
import { batchConsoleApiRef } from '../api/BatchConsoleApi';
import { alertApiRef } from '@backstage/core-plugin-api';

const mockApi = {
  getJobNames: jest.fn().mockResolvedValue(['testJob']),
  getJobs: jest.fn().mockResolvedValue([
    {
      name: 'testJob',
      restartable: true,
      hasSchema: false,
      totalExecutions: 3,
      lastStatus: 'COMPLETED',
      lastExecutionTime: '2026-10-01T12:00:00Z',
    },
  ]),
  getJobSchema: jest.fn().mockResolvedValue(null),
  runJob: jest.fn().mockResolvedValue({ executionId: 101 }),
  getSchedules: jest.fn().mockResolvedValue([
    {
      id: 'sched-1',
      jobName: 'testJob',
      cronExpression: '0 0 * * * *',
      parameters: { key1: 'val1' },
      createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5m ago
      lastExecutionTime: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10m ago
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

describe('SchedulePage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders scheduled jobs table with new columns and opens create dialog', async () => {
    render(
      wrapInTestApp(
        <TestApiProvider
          apis={[
            [batchConsoleApiRef, mockApi],
            [alertApiRef, mockAlertApi],
          ]}
        >
          <SchedulePage />
        </TestApiProvider>
      )
    );

    await waitFor(() => {
      expect(screen.getByText('Scheduled Jobs')).toBeInTheDocument();
      expect(screen.getByText('testJob')).toBeInTheDocument();
      expect(screen.getByText('0 0 * * * *')).toBeInTheDocument();
      expect(screen.getByText('SUCCESS')).toBeInTheDocument();
    });

    // Check table headers
    expect(screen.getByText('Job Name')).toBeInTheDocument();
    expect(screen.getByText('Cron Expression')).toBeInTheDocument();
    expect(screen.getByText('Created At')).toBeInTheDocument();
    expect(screen.getByText('Last Run')).toBeInTheDocument();
    expect(screen.getByText('Last Status')).toBeInTheDocument();
    expect(screen.getByText('Actions')).toBeInTheDocument();

    // Click Create button
    const createBtn = screen.getByRole('button', { name: 'Create' });
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Register Schedule' })).toBeInTheDocument();
    });
  });

  it('expands YAML parameters when row is clicked', async () => {
    render(
      wrapInTestApp(
        <TestApiProvider
          apis={[
            [batchConsoleApiRef, mockApi],
            [alertApiRef, mockAlertApi],
          ]}
        >
          <SchedulePage />
        </TestApiProvider>
      )
    );

    await waitFor(() => {
      expect(screen.getByText('testJob')).toBeInTheDocument();
    });

    // Click row to toggle expansion
    const row = screen.getByText('testJob').closest('tr')!;
    fireEvent.click(row);

    await waitFor(() => {
      expect(screen.getByText('Parameters (YAML):')).toBeInTheDocument();
      expect(screen.getByText(/key1: val1/)).toBeInTheDocument();
    });
  });

  it('opens Run Job modal and executes job', async () => {
    render(
      wrapInTestApp(
        <TestApiProvider
          apis={[
            [batchConsoleApiRef, mockApi],
            [alertApiRef, mockAlertApi],
          ]}
        >
          <SchedulePage />
        </TestApiProvider>
      )
    );

    await waitFor(() => {
      expect(screen.getByText('testJob')).toBeInTheDocument();
    });

    const runBtn = screen.getByRole('button', { name: 'Run testJob' });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(screen.getByText('Run Job: testJob')).toBeInTheDocument();
      expect(screen.getByDisplayValue('key1')).toBeInTheDocument();
      expect(screen.getByDisplayValue('val1')).toBeInTheDocument();
    });

    // Click Run inside modal
    const executeBtn = screen.getByRole('button', { name: 'Run' });
    fireEvent.click(executeBtn);

    await waitFor(() => {
      expect(mockApi.runJob).toHaveBeenCalledWith('testJob', { key1: 'val1' });
      expect(mockAlertApi.post).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success' })
      );
    });
  });

  it('has history button linking to /spring-batch', async () => {
    render(
      wrapInTestApp(
        <TestApiProvider
          apis={[
            [batchConsoleApiRef, mockApi],
            [alertApiRef, mockAlertApi],
          ]}
        >
          <SchedulePage />
        </TestApiProvider>
      )
    );

    await waitFor(() => {
      expect(screen.getByText('testJob')).toBeInTheDocument();
    });

    const historyLink = screen.getByLabelText('View Execution History');
    expect(historyLink).toHaveAttribute('href', '/spring-batch');
  });

  it('calls cancelSchedule when delete button is clicked', async () => {
    render(
      wrapInTestApp(
        <TestApiProvider
          apis={[
            [batchConsoleApiRef, mockApi],
            [alertApiRef, mockAlertApi],
          ]}
        >
          <SchedulePage />
        </TestApiProvider>
      )
    );

    await waitFor(() => {
      expect(screen.getByText('testJob')).toBeInTheDocument();
    });

    const deleteBtn = screen.getByRole('button', { name: 'Delete testJob' });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(mockApi.cancelSchedule).toHaveBeenCalledWith('sched-1');
    });
  });
});
