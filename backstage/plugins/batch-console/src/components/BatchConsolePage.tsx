import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Page, Content } from '@backstage/core-components';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import ButtonGroup from '@material-ui/core/ButtonGroup';
import { ScheduleView } from './ScheduleView';
import { BatchJobsView } from './BatchJobsView';

export type BatchConsoleTab = 'scheduled' | 'jobs';

export const BatchConsolePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const activeTab: BatchConsoleTab = tabParam === 'jobs' ? 'jobs' : 'scheduled';
  const [createDialogOpen, setCreateDialogOpen] = useState(false);

  const handleTabChange = (tab: BatchConsoleTab) => {
    setSearchParams({ tab });
  };

  return (
    <Page themeId="tool">
      <Content>
        {/* 상단 툴바: 좌측 ButtonGroup, 우측 Create 버튼 (Scheduled 탭 전용 노출) */}
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <ButtonGroup variant="outlined" size="small">
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
            createDialogOpen={createDialogOpen}
            onCloseCreateDialog={() => setCreateDialogOpen(false)}
          />
        ) : (
          <BatchJobsView />
        )}
      </Content>
    </Page>
  );
};
