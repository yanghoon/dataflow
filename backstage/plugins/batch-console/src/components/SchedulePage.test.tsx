import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { SchedulePage } from './SchedulePage';
import { TestApiProvider, wrapInTestApp } from '@backstage/test-utils';
import { batchConsoleApiRef } from '../api/BatchConsoleApi';
import { alertApiRef } from '@backstage/core-plugin-api';

const mockApi = {
  getJobNames: jest.fn().mockResolvedValue(['testJob']),
  getJobSchema: jest.fn().mockResolvedValue(null),
  runJob: jest.fn(),
  getSchedules: jest.fn().mockResolvedValue([
    {
      id: 'sched-1',
      jobName: 'testJob',
      cronExpression: '0 0 * * * *',
      parameters: { key1: 'val1' },
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

  it('renders schedules and opens register dialog', async () => {
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
      expect(screen.getByText('sched-1')).toBeInTheDocument();
      expect(screen.getByText('0 0 * * * *')).toBeInTheDocument();
    });

    // Click register button
    const registerBtn = screen.getByText('Register Schedule (신규 스케줄 등록)');
    fireEvent.click(registerBtn);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Register Schedule' })).toBeInTheDocument();
    });
  });
});
