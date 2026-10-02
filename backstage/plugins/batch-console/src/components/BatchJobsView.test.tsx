import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BatchJobsView } from './BatchJobsView';
import { TestApiProvider, wrapInTestApp } from '@backstage/test-utils';
import { batchConsoleApiRef } from '../api/BatchConsoleApi';
import { alertApiRef } from '@backstage/core-plugin-api';

const mockApi = {
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

    // Check that job1 is not an anchor link
    const job1Element = screen.getByText('job1');
    expect(job1Element.closest('a')).toBeNull();
  });

  it('renders Outlined Run text button and opens RunJobDialog modal on click', async () => {
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

    const runBtn = screen.getByRole('button', { name: 'Run job1' });
    expect(runBtn).toBeInTheDocument();
    expect(runBtn.tagName).toBe('BUTTON');

    // Click Run button
    fireEvent.click(runBtn);

    // RunJobDialog modal should open with jobName fixed to job1
    await waitFor(() => {
      expect(screen.getByText('Run Job: job1')).toBeInTheDocument();
      expect(screen.getByText(/수동 즉시 실행은 정기 스케줄 상태와 독립적으로 실행됩니다/)).toBeInTheDocument();
    });

    // Add parameter and run
    const keyInput = screen.getByPlaceholderText('e.g. date');
    const valInput = screen.getByPlaceholderText('e.g. 2026-10-02');
    fireEvent.change(keyInput, { target: { value: 'param1' } });
    fireEvent.change(valInput, { target: { value: 'val1' } });

    const modalRunBtn = screen.getByRole('button', { name: 'Run' });
    fireEvent.click(modalRunBtn);

    await waitFor(() => {
      expect(mockApi.runJob).toHaveBeenCalledWith('job1', { param1: 'val1' });
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
