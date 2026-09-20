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
import { useRouteRefParams } from '@backstage/frontend-plugin-api';
import useAsync from 'react-use/lib/useAsync';
import { siteToolBindingsRouteRef } from '../routes';
import { RequirePermission } from '@backstage/plugin-permission-react';
import { siteToolBindingsReadPermission } from '../permissions';

interface ToolBinding {
  toolSlug: string;
  status: string;
}

const columns: TableColumn[] = [
  { title: 'Tool Slug', field: 'toolSlug' },
  { title: 'Status', field: 'status' },
];

export const SiteToolBindingsPage = () => {
  const { slug } = useRouteRefParams(siteToolBindingsRouteRef);
  const fetchApi = useApi(fetchApiRef);
  const discoveryApi = useApi(discoveryApiRef);

  const { value, loading, error } = useAsync(async (): Promise<ToolBinding[]> => {
    const proxyUrl = await discoveryApi.getBaseUrl('proxy');
    const response = await fetchApi.fetch(
      `${proxyUrl}/spring-platform/api/v1/sites/${slug}/toolbindings`
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch toolbindings: ${response.statusText}`);
    }
    const data = await response.json();
    return data;
  }, [fetchApi, discoveryApi, slug]);

  if (loading) {
    return <Progress />;
  }

  if (error) {
    return <WarningPanel title="Error loading tool bindings" message={error.message} />;
  }

  return (
    <RequirePermission permission={siteToolBindingsReadPermission}>
      <Page themeId="tool">
        <Header title={`Tool Bindings for ${slug}`} subtitle="Manage your tool bindings" />
        <Content>
          <Table
            title="Tool Bindings"
            options={{ search: false, paging: false }}
            columns={columns}
            data={value || []}
          />
        </Content>
      </Page>
    </RequirePermission>
  );
};
