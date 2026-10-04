import { useSearchParams } from 'react-router-dom';
import { Page, Header, Content, InfoCard, Progress } from '@backstage/core-components';
import { useApi, useRouteRefParams, alertApiRef } from '@backstage/core-plugin-api';
import { jobRunRouteRef } from '../routes';
import { batchConsoleApiRef } from '../api/BatchConsoleApi';
import useAsync from 'react-use/lib/useAsync';
import { JobRunForm } from './JobRunForm';

export const JobRunPage = () => {
  const { jobName } = useRouteRefParams(jobRunRouteRef as any) as { jobName: string };
  const [searchParams] = useSearchParams();
  const environment = searchParams.get('environment') || undefined;

  const api = useApi(batchConsoleApiRef);
  const alertApi = useApi(alertApiRef);

  const { value: schema, loading, error } = useAsync(async () => {
    return await api.getJobSchema(jobName, environment);
  }, [api, jobName, environment]);

  const handleSubmit = async (params: Record<string, any>) => {
    try {
      const result = await api.runJob(jobName, params, environment);
      alertApi.post({
        message: `Job ${jobName} launched successfully! Execution ID: ${result.executionId}`,
        severity: 'success',
        display: 'transient',
      });
    } catch (e: any) {
      alertApi.post({
        message: `Failed to launch job: ${e.message}`,
        severity: 'error',
      });
    }
  };

  return (
    <Page themeId="tool">
      <Header title={`Run Job: ${jobName}`} />
      <Content>
        {loading ? (
          <Progress />
        ) : error ? (
          <InfoCard title="Error">Failed to load schema.</InfoCard>
        ) : (
          <InfoCard title="Parameters">
            <JobRunForm schema={schema} onSubmit={handleSubmit} />
          </InfoCard>
        )}
      </Content>
    </Page>
  );
};
