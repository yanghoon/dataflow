import { Fragment, useState } from 'react';
import {
  Page,
  Content,
  InfoCard,
  Progress,
  Link,
} from '@backstage/core-components';
import { batchConsoleApiRef, ScheduleItem } from '../api/BatchConsoleApi';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import useAsync from 'react-use/lib/useAsync';
import useAsyncRetry from 'react-use/lib/useAsyncRetry';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import HistoryIcon from '@material-ui/icons/History';
import AddIcon from '@material-ui/icons/Add';
import IconButton from '@material-ui/core/IconButton';
import Button from '@material-ui/core/Button';
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
import Table from '@material-ui/core/Table';
import TableHead from '@material-ui/core/TableHead';
import TableBody from '@material-ui/core/TableBody';
import TableRow from '@material-ui/core/TableRow';
import TableCell from '@material-ui/core/TableCell';
import Collapse from '@material-ui/core/Collapse';
import Grid from '@material-ui/core/Grid';
import Form from '@rjsf/mui';
import validator from '@rjsf/validator-ajv8';
import { formatRelativeOrAbsoluteTime, StatusChip, toYaml } from './common';

const CRON_PRESETS = [
  { label: '매 시간 (Every Hour)', value: '0 0 * * * *' },
  { label: '매일 자정 (Daily Midnight)', value: '0 0 0 * * *' },
  { label: '매일 오전 9시 (Daily 9 AM)', value: '0 0 9 * * *' },
  { label: '직접 입력 (Custom Cron)', value: 'custom' },
];

export const SchedulePage = () => {
  const api = useApi(batchConsoleApiRef);
  const alertApi = useApi(alertApiRef);

  const { value: schedules, loading, retry } = useAsyncRetry(async () => {
    return await api.getSchedules();
  }, [api]);

  const { value: jobNames } = useAsync(async () => {
    return await api.getJobNames();
  }, [api]);

  // Expansion state for YAML parameters detail panel
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);

  const toggleExpandRow = (id: string) => {
    setExpandedRowId(prev => (prev === id ? null : id));
  };

  // Schedule Dialog State (Create / Edit)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<string>('');
  const [preset, setPreset] = useState<string>('0 0 * * * *');
  const [cronExpression, setCronExpression] = useState<string>('0 0 * * * *');
  const [params, setParams] = useState<Record<string, string>>({});
  const [jobSchema, setJobSchema] = useState<any>(null);

  // Run Dialog State (즉시 실행)
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runJobName, setRunJobName] = useState<string>('');
  const [runJobParams, setRunJobParams] = useState<Array<{ key: string; value: string }>>([
    { key: '', value: '' },
  ]);
  const [runningJob, setRunningJob] = useState(false);

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

  // Run Job Handlers
  const handleOpenRun = (item: ScheduleItem) => {
    setRunJobName(item.jobName);
    const initialParams: Array<{ key: string; value: string }> = [];
    if (item.parameters && Object.keys(item.parameters).length > 0) {
      for (const [key, value] of Object.entries(item.parameters)) {
        initialParams.push({ key, value: String(value) });
      }
    } else {
      initialParams.push({ key: '', value: '' });
    }
    setRunJobParams(initialParams);
    setRunDialogOpen(true);
  };

  const handleAddRunParam = () => {
    setRunJobParams(prev => [...prev, { key: '', value: '' }]);
  };

  const handleRemoveRunParam = (index: number) => {
    setRunJobParams(prev => prev.filter((_, i) => i !== index));
  };

  const handleRunParamChange = (index: number, field: 'key' | 'value', value: string) => {
    setRunJobParams(prev => {
      const next = [...prev];
      next[index][field] = value;
      return next;
    });
  };

  const handleExecuteRun = async () => {
    const paramsObject: Record<string, string> = {};
    for (const param of runJobParams) {
      if (param.key.trim()) {
        paramsObject[param.key.trim()] = param.value;
      }
    }

    try {
      setRunningJob(true);
      const res = await api.runJob(runJobName, paramsObject);
      alertApi.post({
        message: `Job ${runJobName} triggered successfully (Execution ID: ${res.executionId})`,
        severity: 'success',
      });
      setRunDialogOpen(false);
      retry();
    } catch (e: any) {
      alertApi.post({ message: `Failed to run job: ${e.message}`, severity: 'error' });
    } finally {
      setRunningJob(false);
    }
  };

  const scheduleList = schedules || [];

  return (
    <Page themeId="tool">
      {/* Header commented out as requested */}
      {/* <Header title="Schedules" subtitle="Manage Batch Job Schedules" /> */}
      <Content>
        <InfoCard
          title={
            <Box display="flex" alignItems="center" justifyContent="space-between" width="100%">
              <Box>Scheduled Jobs</Box>
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={handleOpenCreate}
              >
                Create
              </Button>
            </Box>
          }
        >
          {loading && scheduleList.length === 0 ? (
            <Progress />
          ) : scheduleList.length === 0 ? (
            <Typography variant="body2" color="textSecondary">
              No scheduled jobs registered.
            </Typography>
          ) : (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell
                    style={{
                      fontWeight: 600,
                      color: 'rgba(0, 0, 0, 0.54)',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Job Name
                  </TableCell>
                  <TableCell
                    style={{
                      fontWeight: 600,
                      color: 'rgba(0, 0, 0, 0.54)',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Cron Expression
                  </TableCell>
                  <TableCell
                    style={{
                      fontWeight: 600,
                      color: 'rgba(0, 0, 0, 0.54)',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Created At
                  </TableCell>
                  <TableCell
                    style={{
                      fontWeight: 600,
                      color: 'rgba(0, 0, 0, 0.54)',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Last Run
                  </TableCell>
                  <TableCell
                    align="center"
                    style={{
                      fontWeight: 600,
                      color: 'rgba(0, 0, 0, 0.54)',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Last Status
                  </TableCell>
                  <TableCell
                    align="right"
                    style={{
                      fontWeight: 600,
                      color: 'rgba(0, 0, 0, 0.54)',
                      fontSize: '0.75rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {scheduleList.map((row, idx) => (
                  <Fragment key={row.id}>
                    <TableRow
                      hover
                      style={{
                        cursor: 'pointer',
                        backgroundColor: idx % 2 === 1 ? 'rgba(0, 0, 0, 0.04)' : 'inherit',
                      }}
                      onClick={() => toggleExpandRow(row.id)}
                    >
                      <TableCell>
                        <Typography variant="body2" style={{ fontWeight: 500 }}>
                          {row.jobName}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <code>{row.cronExpression}</code>
                      </TableCell>
                      <TableCell>
                        {formatRelativeOrAbsoluteTime(row.createdAt)}
                      </TableCell>
                      <TableCell>
                        {formatRelativeOrAbsoluteTime(row.lastExecutionTime)}
                      </TableCell>
                      <TableCell align="center">
                        <StatusChip status={row.lastStatus} />
                      </TableCell>
                      <TableCell align="right" onClick={e => e.stopPropagation()}>
                        <Box display="flex" justifyContent="flex-end" alignItems="center">
                          <IconButton
                            size="small"
                            onClick={() => handleOpenRun(row)}
                            title="Run"
                            aria-label={`Run ${row.jobName}`}
                          >
                            <PlayArrowIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            component={Link}
                            to="/spring-batch"
                            title="History"
                            aria-label="View Execution History"
                          >
                            <HistoryIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleOpenEdit(row)}
                            title="Edit"
                            aria-label={`Edit ${row.jobName}`}
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(row.id)}
                            title="Delete"
                            aria-label={`Delete ${row.jobName}`}
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                        <Collapse in={expandedRowId === row.id} timeout="auto" unmountOnExit>
                          <Box margin={2} p={2} bgcolor="#fafafa" borderRadius={4} border="1px solid #e0e0e0">
                            <Typography variant="subtitle2" gutterBottom style={{ fontWeight: 600 }}>
                              Parameters (YAML):
                            </Typography>
                            <pre
                              style={{
                                margin: 0,
                                fontFamily: 'monospace',
                                fontSize: '0.85rem',
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              {toYaml(row.parameters)}
                            </pre>
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  </Fragment>
                ))}
              </TableBody>
            </Table>
          )}
        </InfoCard>

        {/* Schedule Dialog (Create / Edit) */}
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
                  onChange={e => handleJobChange(e.target.value as string)}
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
                  onChange={e => handlePresetChange(e.target.value as string)}
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
                onChange={e => {
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
                  onChange={e => setParams(e.formData || {})}
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
                          onChange={e => handleParamChange(key, e.target.value, value)}
                        />
                      </Box>
                      <Box ml={1} flex={1}>
                        <TextField
                          fullWidth
                          label="Value"
                          value={value}
                          onChange={e => handleParamChange(key, key, e.target.value)}
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

        {/* Run Job Dialog (즉시 실행) */}
        <Dialog open={runDialogOpen} onClose={() => setRunDialogOpen(false)} maxWidth="md" fullWidth>
          <DialogTitle>Run Job: {runJobName}</DialogTitle>
          <DialogContent>
            <Typography variant="body2" color="textSecondary" style={{ marginBottom: 16 }}>
              Configure parameters for immediate ad-hoc job execution. Existing schedule configuration is not affected.
            </Typography>

            <Typography variant="subtitle1" style={{ fontWeight: 600, marginBottom: 8 }}>
              Job Parameters
            </Typography>

            {runJobParams.map((param, index) => (
              <Grid container spacing={2} key={index} alignItems="center" style={{ marginBottom: 8 }}>
                <Grid item xs={5}>
                  <TextField
                    fullWidth
                    label="Key"
                    size="small"
                    variant="outlined"
                    value={param.key}
                    onChange={e => handleRunParamChange(index, 'key', e.target.value)}
                    placeholder="e.g. date"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Value"
                    size="small"
                    variant="outlined"
                    value={param.value}
                    onChange={e => handleRunParamChange(index, 'value', e.target.value)}
                    placeholder="e.g. 2026-10-02"
                  />
                </Grid>
                <Grid item xs={1}>
                  <IconButton
                    color="secondary"
                    onClick={() => handleRemoveRunParam(index)}
                    disabled={runJobParams.length === 1 && !param.key && !param.value}
                    title="Remove Parameter"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            ))}

            <Box mt={1}>
              <Button
                startIcon={<AddIcon />}
                onClick={handleAddRunParam}
                variant="outlined"
                size="small"
              >
                Add Parameter
              </Button>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setRunDialogOpen(false)} disabled={runningJob}>
              Cancel
            </Button>
            <Button
              color="primary"
              variant="contained"
              startIcon={<PlayArrowIcon />}
              onClick={handleExecuteRun}
              disabled={runningJob}
            >
              {runningJob ? 'Running...' : 'Run'}
            </Button>
          </DialogActions>
        </Dialog>
      </Content>
    </Page>
  );
};
