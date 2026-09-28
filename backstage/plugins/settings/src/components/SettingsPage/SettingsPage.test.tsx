
import { screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPage } from './SettingsPage';
import { TestApiProvider, renderInTestApp } from '@backstage/test-utils';
import { settingsApiRef } from '../../api';

const mockConfigs = [
  {
    key: 'test.string',
    type: 'STRING' as const,
    label: 'Test String',
    description: 'A test string',
    value: 'abc',
  },
  {
    key: 'test.boolean',
    type: 'BOOLEAN' as const,
    label: 'Test Boolean',
    description: 'A test boolean',
    value: true,
  },
];

describe('SettingsPage unit', () => {
  let mockSettingsApi: any;

  beforeEach(() => {
    mockSettingsApi = {
      getConfigs: jest.fn().mockResolvedValue(mockConfigs),
      updateConfigs: jest.fn().mockResolvedValue(undefined),
    };
  });

  const renderComponent = async () =>
    renderInTestApp(
      <TestApiProvider apis={[[settingsApiRef, mockSettingsApi]]}>
        <SettingsPage />
      </TestApiProvider>
    );

  it('filters by search text', async () => {
    await renderComponent();
    expect(await screen.findByText('Test String')).toBeInTheDocument();
    expect(screen.getByText('Test Boolean')).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText('Search settings...');
    fireEvent.change(searchInput, { target: { value: 'String' } });

    expect(screen.getByText('Test String')).toBeInTheDocument();
    expect(screen.queryByText('Test Boolean')).not.toBeInTheDocument();
  });

  it('marks item as dirty and shows visual indicator on change', async () => {
    await renderComponent();
    expect(await screen.findByText('Test String')).toBeInTheDocument();

    const input = screen.getByLabelText('Test String');
    fireEvent.change(input, { target: { value: 'xyz' } });

    expect(screen.getByText('*')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeDisabled();
  });

  it('only sends dirty items on save', async () => {
    await renderComponent();
    expect(await screen.findByText('Test String')).toBeInTheDocument();

    const input = screen.getByLabelText('Test String');
    fireEvent.change(input, { target: { value: 'xyz' } });

    const saveButton = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(mockSettingsApi.updateConfigs).toHaveBeenCalledWith([
        {
          key: 'test.string',
          type: 'STRING',
          label: 'Test String',
          description: 'A test string',
          value: 'xyz',
        },
      ]);
    });
  });
});
