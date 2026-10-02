import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ScheduleView } from './ScheduleView';
import { TestApiProvider, wrapInTestApp } from '@backstage/test-utils';
import { batchConsoleApiRef } from '../api/BatchConsoleApi';
import { alertApiRef } from '@backstage/core-plugin-api';

const mockApi = {
  getJobNames: jest.fn().mockResolvedValue(['testJob']),
  getJobs: jest.fn().mockResolvedValue([]),
  getJobSchema: jest.fn().mockResolvedValue(null),
  runJob: jest.fn().mockResolvedValue({ executionId: 101 }),
  getSchedules: jest.fn().mockResolvedValue([
    {
      id: 'sched-1',
      jobName: 'testJob',
      cronExpression: '0 0 * * * *',
      parameters: { key1: 'val1' },
      createdAt: null, // Test null createdAt -> '-'
      lastExecutionTime: null,
      lastStatus: null, // Test null lastStatus -> '-'
    },
  ]),
  createSchedule: jest.fn().mockResolvedValue({ id: 'sched-2' }),
  updateSchedule: jest.fn().mockResolvedValue(undefined),
  cancelSchedule: jest.fn().mockResolvedValue(undefined),
};

const mockAlertApi = {
  post: jest.fn(),
};

describe('ScheduleView', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders columns in new order and displays "-" for null values', async () => {
    render(
      wrapInTestApp(
        <TestApiProvider
          apis={[
            [batchConsoleApiRef, mockApi],
            [alertApiRef, mockAlertApi],
          ]}
        >
          <ScheduleView />
        </TestApiProvider>
      )
    );

    await waitFor(() => {
      expect(screen.getByText('Scheduled Jobs')).toBeInTheDocument();
      expect(screen.getByText('testJob')).toBeInTheDocument();
      expect(screen.getByText('0 0 * * * *')).toBeInTheDocument();
    });

    // Check table headers in order: Job Name -> Cron Expression -> Last Status -> Last Run -> Created At -> Actions
    const headers = screen.getAllByRole('columnheader').map(th => th.textContent);
    expect(headers).toEqual([
      'Job Name',
      'Cron Expression',
      'Last Status',
      'Last Run',
      'Created At',
      'Actions',
    ]);

    // Check that null createdAt and lastStatus render as '-'
    const hyphenElements = screen.getAllByText('-');
    expect(hyphenElements.length).toBeGreaterThanOrEqual(2);
  });

  it('renders Outlined Run text button, History, Edit, and Delete action buttons', async () => {
    render(
      wrapInTestApp(
        <TestApiProvider
          apis={[
            [batchConsoleApiRef, mockApi],
            [alertApiRef, mockAlertApi],
          ]}
        >
          <ScheduleView />
        </TestApiProvider>
      )
    );

    await waitFor(() => {
      expect(screen.getByText('testJob')).toBeInTheDocument();
    });

    // Outlined Run text button
    const runBtn = screen.getByRole('button', { name: 'Run testJob' });
    expect(runBtn).toBeInTheDocument();
    expect(runBtn.textContent).toContain('Run');

    // History button
    const historyLink = screen.getByLabelText('View Execution History');
    expect(historyLink).toHaveAttribute('href', '/spring-batch');

    // Edit button
    expect(screen.getByLabelText('Edit testJob')).toBeInTheDocument();

    // Delete button
    expect(screen.getByLabelText('Delete testJob')).toBeInTheDocument();
  });

  it('expands Key-Value parameters grid card when row is clicked', async () => {
    render(
      wrapInTestApp(
        <TestApiProvider
          apis={[
            [batchConsoleApiRef, mockApi],
            [alertApiRef, mockAlertApi],
          ]}
        >
          <ScheduleView />
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
      expect(screen.getByText('Parameters:')).toBeInTheDocument();
      expect(screen.getByText('key1')).toBeInTheDocument();
      expect(screen.getByText('val1')).toBeInTheDocument();
    });
  });

  it('opens RunJobDialog with prefilled parameters and executes job', async () => {
    render(
      wrapInTestApp(
        <TestApiProvider
          apis={[
            [batchConsoleApiRef, mockApi],
            [alertApiRef, mockAlertApi],
          ]}
        >
          <ScheduleView />
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

    const executeBtn = screen.getByRole('button', { name: 'Run' });
    fireEvent.click(executeBtn);

    await waitFor(() => {
      expect(mockApi.runJob).toHaveBeenCalledWith('testJob', { key1: 'val1' });
      expect(mockAlertApi.post).toHaveBeenCalledWith(
        expect.objectContaining({ severity: 'success' })
      );
    });
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
          <ScheduleView />
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
