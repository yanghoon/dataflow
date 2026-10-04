import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Content } from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import useAsync from 'react-use/lib/useAsync';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import ButtonGroup from '@material-ui/core/ButtonGroup';
import { batchConsoleApiRef } from '../api/BatchConsoleApi';
import { ScheduleView } from './ScheduleView';
import { BatchJobsView } from './BatchJobsView';

export type BatchConsoleTab = 'scheduled' | 'jobs';

export const BatchConsolePage = () => {
  const api = useApi(batchConsoleApiRef);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: BatchConsoleTab = tabParam === 'jobs' ? 'jobs' : 'scheduled';
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const { value: envData } = useAsync(async () => {
    return await api.getEnvironments();
  }, [api]);

  const envParam = searchParams.get('environment');
  const currentEnv =
    envParam ||
    envData?.defaultEnvironment ||
    (envData?.environments && envData.environments.length > 0
      ? envData.environments[0]
      : '');

  const handleTabChange = (tab: BatchConsoleTab) => {
    const newParams: Record<string, string> = { tab };
    if (currentEnv) {
      newParams.environment = currentEnv;
    }
    setSearchParams(newParams);
  };

  const handleEnvChange = (env: string) => {
    const newParams: Record<string, string> = {};
    if (tabParam) {
      newParams.tab = tabParam;
    }
    newParams.environment = env;
    setSearchParams(newParams);
  };

  return (
    <Page themeId="tool">
      <Content>
        {/* 상단 툴바: 좌측 ButtonGroup(탭 및 인스턴스), 우측 Create 버튼 (Scheduled 탭 전용 노출) */}
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Box display="flex" alignItems="center">
            <ButtonGroup variant="outlined" size="small" style={{ marginRight: 16 }}>
              <Button
                variant={activeTab === 'scheduled' ? 'contained' : 'outlined'}
                color={activeTab === 'scheduled' ? 'primary' : 'default'}
                onClick={() => handleTabChange('scheduled')}
              >
                Scheduled
              </Button>
              <Button
                variant={activeTab === 'jobs' ? 'contained' : 'outlined'}
                color={activeTab === 'jobs' ? 'primary' : 'default'}
                onClick={() => handleTabChange('jobs')}
              >
                Jobs
              </Button>
            </ButtonGroup>

            {envData && envData.environments && envData.environments.length > 0 && (
              <ButtonGroup variant="outlined" size="small">
                {envData.environments.map(env => (
                  <Button
                    key={env}
                    variant={currentEnv === env ? 'contained' : 'outlined'}
                    color={currentEnv === env ? 'primary' : 'default'}
                    onClick={() => handleEnvChange(env)}
                  >
                    {env}
                  </Button>
                ))}
              </ButtonGroup>
            )}
          </Box>

          {/* Jobs 탭에서는 Create 버튼 비노출 (Scheduled 탭에서만 활성화) */}
          {activeTab === 'scheduled' && (
            <Button
              variant="contained"
              color="primary"
              size="small"
              onClick={() => setCreateDialogOpen(true)}
            >
              Create
            </Button>
          )}
        </Box>

        {/* 탭 컨텐츠 렌더링 */}
        {activeTab === 'scheduled' ? (
          <ScheduleView
            environment={currentEnv}
            createDialogOpen={createDialogOpen}
            onCloseCreateDialog={() => setCreateDialogOpen(false)}
          />
        ) : (
          <BatchJobsView environment={currentEnv} />
        )}
      </Content>
    </Page>
  );
};
