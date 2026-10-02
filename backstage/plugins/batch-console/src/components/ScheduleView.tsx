import { Fragment, useState, useEffect, useCallback } from 'react';
import { InfoCard, Progress, Link } from '@backstage/core-components';
import { batchConsoleApiRef, ScheduleItem } from '../api/BatchConsoleApi';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import useAsync from 'react-use/lib/useAsync';
import useAsyncRetry from 'react-use/lib/useAsyncRetry';
import DeleteIcon from '@material-ui/icons/Delete';
import EditIcon from '@material-ui/icons/Edit';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import HistoryIcon from '@material-ui/icons/History';
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
import Form from '@rjsf/mui';
import validator from '@rjsf/validator-ajv8';
import { useTheme } from '@material-ui/core/styles';
import { formatRelativeOrAbsoluteTime, StatusChip, KeyValueParametersView } from './common';
import { RunJobDialog } from './RunJobDialog';

const CRON_PRESETS = [
  { label: '매 시간 (Every Hour)', value: '0 0 * * * *' },
  { label: '매일 자정 (Daily Midnight)', value: '0 0 0 * * *' },
  { label: '매일 오전 9시 (Daily 9 AM)', value: '0 0 9 * * *' },
  { label: '직접 입력 (Custom Cron)', value: 'custom' },
];

export interface ScheduleViewProps {
  createDialogOpen?: boolean;
  onCloseCreateDialog?: () => void;
}

export const ScheduleView = ({ createDialogOpen, onCloseCreateDialog }: ScheduleViewProps) => {
  const theme = useTheme();
  const api = useApi(batchConsoleApiRef);
  const alertApi = useApi(alertApiRef);

  const { value: schedules, loading, retry } = useAsyncRetry(async () => {
    return await api.getSchedules();
  }, [api]);

  const { value: jobNames } = useAsync(async () => {
    return await api.getJobNames();
  }, [api]);

  // Expansion state for Key-Value parameters detail panel
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

  // Run Dialog State
  const [runDialogOpen, setRunDialogOpen] = useState(false);
  const [runJobName, setRunJobName] = useState<string>('');
  const [runJobParams, setRunJobParams] = useState<Record<string, any>>({});

  const handleOpenCreate = useCallback(() => {
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
  }, [api, jobNames]);

  useEffect(() => {
    if (createDialogOpen) {
      handleOpenCreate();
    }
  }, [createDialogOpen, handleOpenCreate]);

  const handleCloseDialog = () => {
    setDialogOpen(false);
    onCloseCreateDialog?.();
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
      handleCloseDialog();
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

  const handleOpenRun = (item: ScheduleItem) => {
    setRunJobName(item.jobName);
    setRunJobParams(item.parameters || {});
    setRunDialogOpen(true);
  };

  const scheduleList = schedules || [];

  const headerCellStyle = {
    fontWeight: 600,
    color: theme.palette.text.secondary,
    fontSize: '0.75rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  };

  return (
    <>
      <InfoCard title="Scheduled Jobs">
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
                <TableCell style={headerCellStyle}>Job Name</TableCell>
                <TableCell style={headerCellStyle}>Cron Expression</TableCell>
                <TableCell align="center" style={headerCellStyle}>Last Status</TableCell>
                <TableCell style={headerCellStyle}>Last Run</TableCell>
                <TableCell style={headerCellStyle}>Created At</TableCell>
                <TableCell align="right" style={headerCellStyle}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {scheduleList.map((row, idx) => (
                <Fragment key={row.id}>
                  <TableRow
                    hover
                    style={{
                      cursor: 'pointer',
                      backgroundColor: idx % 2 === 1 ? theme.palette.action.hover : 'inherit',
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
                    <TableCell align="center">
                      <StatusChip status={row.lastStatus} />
                    </TableCell>
                    <TableCell>
                      {formatRelativeOrAbsoluteTime(row.lastExecutionTime)}
                    </TableCell>
                    <TableCell>
                      {formatRelativeOrAbsoluteTime(row.createdAt)}
                    </TableCell>
                    <TableCell align="right" onClick={e => e.stopPropagation()}>
                      <Box display="flex" justifyContent="flex-end" alignItems="center">
                        {/* Run Text Button with PlayArrow Icon */}
                        <Button
                          size="small"
                          variant="outlined"
                          color="primary"
                          startIcon={<PlayArrowIcon />}
                          onClick={() => handleOpenRun(row)}
                          style={{ marginRight: 8 }}
                          aria-label={`Run ${row.jobName}`}
                        >
                          Run
                        </Button>
                        {/* History Icon Button with neutral tone */}
                        <IconButton
                          size="small"
                          component={Link}
                          to="/spring-batch"
                          title="History"
                          aria-label="View Execution History"
                        >
                          <HistoryIcon color="action" />
                        </IconButton>
                        {/* Edit Action */}
                        <IconButton
                          size="small"
                          onClick={() => handleOpenEdit(row)}
                          title="Edit"
                          aria-label={`Edit ${row.jobName}`}
                        >
                          <EditIcon color="action" />
                        </IconButton>
                        {/* Delete Action */}
                        <IconButton
                          size="small"
                          onClick={() => handleDelete(row.id)}
                          title="Delete"
                          aria-label={`Delete ${row.jobName}`}
                        >
                          <DeleteIcon color="secondary" />
                        </IconButton>
                      </Box>
                    </TableCell>
                  </TableRow>
                  {/* Key-Value Parameters Expanded Row */}
                  <TableRow>
                    <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={6}>
                      <Collapse in={expandedRowId === row.id} timeout="auto" unmountOnExit>
                        <KeyValueParametersView parameters={row.parameters} />
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
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
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
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button color="primary" variant="contained" onClick={handleSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Run Job Dialog */}
      <RunJobDialog
        open={runDialogOpen}
        jobName={runJobName}
        initialParameters={runJobParams}
        onClose={() => setRunDialogOpen(false)}
        onSuccess={() => retry()}
      />
    </>
  );
};
