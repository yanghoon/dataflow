import { renderInTestApp } from '@backstage/frontend-test-utils';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { SettingsPage } from './SettingsPage';

const server = setupServer(
  rest.get('*/api/config/settings', (_req, res, ctx) => {
    return res(
      ctx.status(200),
      ctx.json({
        schema: {
          title: "Settings",
          type: "object",
          required: ["example"],
          properties: {
            example: { type: "string", title: "Example Setting", default: "Default value" },
            retries: { type: "integer", title: "Retries", default: 3 }
          }
        },
        data: {
          example: "Test",
          retries: 5
        }
      })
    );
  }),
  rest.post('*/api/config/settings', (_req, res, ctx) => {
    return res(ctx.status(200), ctx.json({}));
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('SettingsPage', () => {
  it('renders settings form', async () => {
    await renderInTestApp(<SettingsPage />);
    
    await waitFor(() => {
      expect(screen.getAllByText('Settings').length).toBeGreaterThan(0);
      expect(screen.getByText('Example Setting')).toBeInTheDocument();
      expect(screen.getByText('Retries')).toBeInTheDocument();
    });
  });

  it('shows error alert on 409 conflict and keeps it until closed', async () => {
    server.use(
      rest.post('*/api/config/settings', (_req, res, ctx) => {
        return res(ctx.status(409), ctx.json({ message: 'Conflict' }));
      })
    );

    await renderInTestApp(<SettingsPage />);
    
    // Wait for the form to load
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    });

    const submitBtn = screen.getByRole('button', { name: /submit/i });
    userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/Conflict: The settings were updated by someone else/i)).toBeInTheDocument();
    });

    const closeBtn = screen.getByRole('button', { name: /close/i });
    userEvent.click(closeBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Conflict: The settings were updated by someone else/i)).not.toBeInTheDocument();
    });
  });
});
