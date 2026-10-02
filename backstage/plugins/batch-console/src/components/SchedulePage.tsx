import React, { useState } from 'react';
import {
  Page,
  Header,
  Content,
  Table,
  TableColumn,
  Button,
} from '@backstage/core-components';
import { batchConsoleApiRef } from '../api/BatchConsoleApi';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import useAsync from 'react-use/lib/useAsync';
import useAsyncRetry from 'react-use/lib/useAsyncRetry';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import IconButton from '@material-ui/core/IconButton';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import TextField from '@material-ui/core/TextField';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import Form from '@rjsf/mui';
import validator from '@rjsf/validator-ajv8';

const CRON_PRESETS = [
  { label: '매 시간 (Every Hour)', value: '0 0 * * * *' },
  { label: '매일 자정 (Daily Midnight)', value: '0 0 0 * * *' },
  { label: '매일 오전 9시 (Daily 9 AM)', value: '0 0 9 * * *' },
  { label: '직접 입력 (Custom Cron)', value: 'custom' },
];

interface ScheduleItem {
  id: string;
  jobName: string;
  cronExpression: string;
  parameters: Record<string, string>;
}

export const SchedulePage = () => {
  const api = useApi(batchConsoleApiRef);
  const alertApi = useApi(alertApiRef);

  const { value: schedules, loading, retry } = useAsyncRetry(async () => {
    return (await api.getSchedules()) as ScheduleItem[];
  }, [api]);

  const { value: jobNames } = useAsync(async () => {
    return await api.getJobNames();
  }, [api]);

  // Dialog State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<string>('');
  const [preset, setPreset] = useState<string>('0 0 * * * *');
  const [cronExpression, setCronExpression] = useState<string>('0 0 * * * *');
  const [params, setParams] = useState<Record<string, string>>({});
  const [jobSchema, setJobSchema] = useState<any>(null);

  const handleOpenCreate = () => {
    const defaultJob = jobNames && jobNames.length > 0 ? jobNames[0] : '';
    setEditingId(null);
    setSelectedJob(defaultJob);
    setPreset('0 0 * * * *');
    setCronExpression('0 0 * * * *');
    setParams({});
    if (defaultJob) {
      api.getJobSchema(defaultJob).then(setJobSchema).catch(() => setJobSchema(null));
    } else {
      setJobSchema(null);
    }
    setDialogOpen(true);
  };

  const handleOpenEdit = async (item: ScheduleItem) => {
    setEditingId(item.id);
    setSelectedJob(item.jobName);
    const matchingPreset = CRON_PRESETS.find(p => p.value === item.cronExpression);
    setPreset(matchingPreset ? matchingPreset.value : 'custom');
    setCronExpression(item.cronExpression);
    setParams(item.parameters || {});
    try {
      const schema = await api.getJobSchema(item.jobName);
      setJobSchema(schema);
    } catch {
      setJobSchema(null);
    }
    setDialogOpen(true);
  };

  const handleJobChange = async (job: string) => {
    setSelectedJob(job);
    try {
      const schema = await api.getJobSchema(job);
      setJobSchema(schema);
    } catch {
      setJobSchema(null);
    }
  };

  const handlePresetChange = (value: string) => {
    setPreset(value);
    if (value !== 'custom') {
      setCronExpression(value);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.cancelSchedule(id);
      alertApi.post({ message: 'Schedule cancelled successfully', severity: 'success' });
      retry();
    } catch (e: any) {
      alertApi.post({ message: `Failed to cancel schedule: ${e.message}`, severity: 'error' });
    }
  };

  const handleSave = async () => {
    if (!selectedJob) {
      alertApi.post({ message: 'Please select a job', severity: 'warning' });
      return;
    }
    if (!cronExpression) {
      alertApi.post({ message: 'Please specify a cron expression', severity: 'warning' });
      return;
    }

    try {
      if (editingId) {
        await api.updateSchedule(editingId, selectedJob, cronExpression, params);
        alertApi.post({ message: 'Schedule updated successfully', severity: 'success' });
      } else {
        await api.createSchedule(selectedJob, cronExpression, params);
        alertApi.post({ message: 'Schedule registered successfully', severity: 'success' });
      }
      setDialogOpen(false);
      retry();
    } catch (e: any) {
      alertApi.post({ message: `Failed to save schedule: ${e.message}`, severity: 'error' });
    }
  };

  const handleAddParam = () => {
    setParams(prev => ({ ...prev, '': '' }));
  };

  const handleParamChange = (oldKey: string, newKey: string, value: string) => {
    setParams(prev => {
      const next = { ...prev };
      if (oldKey !== newKey) {
        delete next[oldKey];
      }
      next[newKey] = value;
      return next;
    });
  };

  const columns: TableColumn[] = [
    { title: 'ID', field: 'id' },
    { title: 'Job Name', field: 'jobName' },
    { title: 'Cron Expression', field: 'cronExpression' },
    {
      title: 'Parameters',
      field: 'parameters',
      render: (row: any) => (
        <span>{row.parameters ? JSON.stringify(row.parameters) : '-'}</span>
      ),
    },
    {
      title: 'Actions',
      render: (row: any) => (
        <Box display="flex">
          <IconButton onClick={() => handleOpenEdit(row)} title="Edit">
            <EditIcon />
          </IconButton>
          <IconButton onClick={() => handleDelete(row.id)} title="Delete">
            <DeleteIcon />
          </IconButton>
        </Box>
      ),
    },
  ];

  return (
    <Page themeId="tool">
      <Header title="Schedules" subtitle="Manage Batch Job Schedules" />
      <Content>
        <Box mb={2}>
          <Button
            variant="contained"
            color="primary"
            onClick={handleOpenCreate}
          >
            Register Schedule (신규 스케줄 등록)
          </Button>
        </Box>
        <Table
          options={{ search: true, paging: true }}
          columns={columns}
          data={schedules || []}
          title="Scheduled Jobs"
          isLoading={loading}
        />

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>{editingId ? 'Edit Schedule' : 'Register Schedule'}</DialogTitle>
          <DialogContent>
            <Box my={2}>
              <FormControl fullWidth variant="outlined">
                <InputLabel id="job-select-label">Job</InputLabel>
                <Select
                  labelId="job-select-label"
                  value={selectedJob}
                  disabled={!!editingId}
                  label="Job"
                  onChange={(e) => handleJobChange(e.target.value as string)}
                >
                  {(jobNames || []).map(name => (
                    <MenuItem key={name} value={name}>{name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box my={2}>
              <FormControl fullWidth variant="outlined">
                <InputLabel id="preset-select-label">Schedule Frequency</InputLabel>
                <Select
                  labelId="preset-select-label"
                  value={preset}
                  label="Schedule Frequency"
                  onChange={(e) => handlePresetChange(e.target.value as string)}
                >
                  {CRON_PRESETS.map(p => (
                    <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box my={2}>
              <TextField
                fullWidth
                label="Cron Expression"
                variant="outlined"
                value={cronExpression}
                onChange={(e) => {
                  setCronExpression(e.target.value);
                  setPreset('custom');
                }}
                helperText="e.g. 0 0 * * * * (Spring/Cron expression)"
              />
            </Box>

            <Box my={2}>
              <Typography variant="h6" gutterBottom>Parameters</Typography>
              {jobSchema && Object.keys(jobSchema).length > 0 ? (
                <Form
                  schema={jobSchema}
                  validator={validator}
                  formData={params}
                  onChange={(e) => setParams(e.formData || {})}
                >
                  <></>
                </Form>
              ) : (
                <Box>
                  <Typography variant="body2" color="textSecondary">
                    No schema found. Add parameters manually:
                  </Typography>
                  {Object.entries(params).map(([key, value], i) => (
                    <Box key={i} display="flex" my={1}>
                      <Box mr={1} flex={1}>
                        <TextField
                          fullWidth
                          label="Key"
                          value={key}
                          onChange={(e) => handleParamChange(key, e.target.value, value)}
                        />
                      </Box>
                      <Box ml={1} flex={1}>
                        <TextField
                          fullWidth
                          label="Value"
                          value={value}
                          onChange={(e) => handleParamChange(key, key, e.target.value)}
                        />
                      </Box>
                    </Box>
                  ))}
                  <Box mt={1}>
                    <Button variant="outlined" size="small" onClick={handleAddParam}>
                      Add Parameter
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button color="primary" variant="contained" onClick={handleSave}>
              Save
            </Button>
          </DialogActions>
        </Dialog>
      </Content>
    </Page>
  );
};
