import { useState, useEffect } from 'react';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import Typography from '@material-ui/core/Typography';
import TextField from '@material-ui/core/TextField';
import Grid from '@material-ui/core/Grid';
import Box from '@material-ui/core/Box';
import Button from '@material-ui/core/Button';
import IconButton from '@material-ui/core/IconButton';
import PlayArrowIcon from '@material-ui/icons/PlayArrow';
import DeleteIcon from '@material-ui/icons/Delete';
import AddIcon from '@material-ui/icons/Add';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import { batchConsoleApiRef } from '../api/BatchConsoleApi';

export interface RunJobDialogProps {
  open: boolean;
  jobName: string;
  initialParameters?: Record<string, any>;
  onClose: () => void;
  onSuccess?: () => void;
}

export const RunJobDialog = ({
  open,
  jobName,
  initialParameters,
  onClose,
  onSuccess,
}: RunJobDialogProps) => {
  const api = useApi(batchConsoleApiRef);
  const alertApi = useApi(alertApiRef);
  const [params, setParams] = useState<Array<{ key: string; value: string }>>([]);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (open) {
      if (initialParameters && Object.keys(initialParameters).length > 0) {
        setParams(
          Object.entries(initialParameters).map(([k, v]) => ({
            key: k,
            value: String(v),
          }))
        );
      } else {
        setParams([{ key: '', value: '' }]);
      }
    }
  }, [open, initialParameters]);

  const handleAddParam = () => setParams(prev => [...prev, { key: '', value: '' }]);
  const handleRemoveParam = (index: number) =>
    setParams(prev => prev.filter((_, i) => i !== index));
  const handleParamChange = (
    index: number,
    field: 'key' | 'value',
    value: string
  ) => {
    setParams(prev => {
      const next = [...prev];
      next[index][field] = value;
      return next;
    });
  };

  const handleExecute = async () => {
    const payload: Record<string, string> = {};
    for (const p of params) {
      if (p.key.trim()) payload[p.key.trim()] = p.value;
    }

    try {
      setRunning(true);
      const res = await api.runJob(jobName, payload);
      alertApi.post({
        message: `Job ${jobName} triggered successfully (Execution ID: ${res.executionId})`,
        severity: 'success',
      });
      onClose();
      onSuccess?.();
    } catch (e: any) {
      alertApi.post({ message: `Failed to run job: ${e.message}`, severity: 'error' });
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Run Job: {jobName}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="textSecondary" style={{ marginBottom: 16 }}>
          Configure parameters for immediate ad-hoc job execution. 수동 즉시 실행은 정기 스케줄 상태와 독립적으로 실행됩니다.
        </Typography>
        <Typography variant="subtitle1" style={{ fontWeight: 600, marginBottom: 8 }}>
          Job Parameters
        </Typography>
        {params.map((param, index) => (
          <Grid
            container
            spacing={2}
            key={index}
            alignItems="center"
            style={{ marginBottom: 8 }}
          >
            <Grid item xs={5}>
              <TextField
                fullWidth
                label="Key"
                size="small"
                variant="outlined"
                value={param.key}
                onChange={e => handleParamChange(index, 'key', e.target.value)}
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
                onChange={e => handleParamChange(index, 'value', e.target.value)}
                placeholder="e.g. 2026-10-02"
              />
            </Grid>
            <Grid item xs={1}>
              <IconButton
                color="secondary"
                onClick={() => handleRemoveParam(index)}
                disabled={params.length === 1 && !param.key && !param.value}
                title="Remove Parameter"
                aria-label="Remove Parameter"
              >
                <DeleteIcon />
              </IconButton>
            </Grid>
          </Grid>
        ))}
        <Box mt={1}>
          <Button
            startIcon={<AddIcon />}
            onClick={handleAddParam}
            variant="outlined"
            size="small"
          >
            Add Parameter
          </Button>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={running}>
          Cancel
        </Button>
        <Button
          color="primary"
          variant="contained"
          startIcon={<PlayArrowIcon />}
          onClick={handleExecute}
          disabled={running}
        >
          {running ? 'Running...' : 'Run'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
