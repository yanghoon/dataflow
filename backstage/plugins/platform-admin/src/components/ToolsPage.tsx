import { RequirePermission } from '@backstage/plugin-permission-react';
import { toolsReadPermission } from '../permissions';

import {
  Page,
  Header,
  Content,
  Table,
  TableColumn,
  Progress,
  WarningPanel,
} from '@backstage/core-components';
import { useApi, fetchApiRef, discoveryApiRef } from '@backstage/core-plugin-api';
import useAsync from 'react-use/lib/useAsync';

interface Item {
  slug: string;
  name: string;
  status: string;
}

const columns: TableColumn[] = [
  { title: 'Slug', field: 'slug' },
  { title: 'Name', field: 'name' },
  { title: 'Status', field: 'status' },
];

export const ToolsPage = () => {
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);

  const { value, loading, error } = useAsync(async (): Promise<Item[]> => {
    const proxyUrl = await discoveryApi.getBaseUrl('proxy');
    const response = await fetchApi.fetch(
      `${proxyUrl}/spring-platform/api/v1/platform/tools`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch tools: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  }, [fetchApi, discoveryApi]);

  if (loading) {
    return <Progress />;
  }

  if (error) {
    return <WarningPanel title="Error loading tools" message={error.message} />;
  }

  return (
    <RequirePermission permission={toolsReadPermission}>
      <Page themeId="tool">
        <Header title="Platform Tools" subtitle="Manage your platform tools" />
        <Content>
          <Table
            title="Tools"
            options={{ search: false, paging: false }}
            columns={columns}
            data={value || []}
          />
        </Content>
      </Page>
    </RequirePermission>
  );
};
