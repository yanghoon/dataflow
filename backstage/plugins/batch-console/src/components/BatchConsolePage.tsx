import { Table, TableColumn, Link } from '@backstage/core-components';
import { useApi, useRouteRef } from '@backstage/core-plugin-api';
import { batchConsoleApiRef } from '../api/BatchConsoleApi';
import useAsync from 'react-use/lib/useAsync';
import { jobRunRouteRef } from '../routes';

export const BatchConsolePage = () => {
  const api = useApi(batchConsoleApiRef);
  const jobRunRoute = useRouteRef(jobRunRouteRef);

  const { value: jobs, loading } = useAsync(async () => {
    return await api.getJobNames();
  }, [api]);

  const columns: TableColumn[] = [
    {
      title: 'Job Name',
      field: 'name',
      render: (rowData: any) => (
        <Link to={jobRunRoute ? jobRunRoute({ jobName: rowData.name }) : ''}>{rowData.name}</Link>
      ),
    },
  ];

  const data = (jobs || []).map(name => ({ name }));

  return (
    <Table
      title="Spring Batch Jobs"
      options={{ search: true, paging: true }}
      columns={columns}
      data={data}
      isLoading={loading}
    />
  );
};
