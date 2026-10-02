import { Page, Content } from '@backstage/core-components';
import { BatchJobsView } from './BatchJobsView';

export const BatchJobsPage = () => {
  return (
    <Page themeId="tool">
      <Content>
        <BatchJobsView />
      </Content>
    </Page>
  );
};
