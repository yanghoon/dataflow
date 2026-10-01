import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { JobRunPage } from './JobRunPage';
import { TestApiProvider, wrapInTestApp } from '@backstage/test-utils';
import { batchConsoleApiRef } from '../api/BatchConsoleApi';
import { alertApiRef } from '@backstage/core-plugin-api';

const mockApi = {
  getJobNames: jest.fn(),
  getJobSchema: jest.fn().mockResolvedValue(null), // fallback mode
  runJob: jest.fn().mockResolvedValue({ executionId: 101 }),
};

const mockAlertApi = {
  post: jest.fn(),
};

jest.mock('@backstage/core-plugin-api', () => ({
  ...jest.requireActual('@backstage/core-plugin-api'),
  useRouteRefParams: () => ({ jobName: 'testJob' }),
}));

describe('JobRunPage', () => {
  it('renders and runs fallback form', async () => {
    render(
      wrapInTestApp(
        <TestApiProvider apis={[[batchConsoleApiRef, mockApi], [alertApiRef, mockAlertApi]]}>
          <JobRunPage />
        </TestApiProvider>
      )
    );

    await waitFor(() => {
      expect(screen.getByText(/Run Job: testJob/i)).toBeInTheDocument();
      expect(screen.getByText(/No schema found/i)).toBeInTheDocument();
    });

    const runBtn = screen.getByRole('button', { name: /Run Job/i });
    fireEvent.click(runBtn);

    await waitFor(() => {
      expect(mockApi.runJob).toHaveBeenCalledWith('testJob', {});
      expect(mockAlertApi.post).toHaveBeenCalledWith(expect.objectContaining({
        message: expect.stringContaining('101'),
        severity: 'success'
      }));
    });
  });
});
