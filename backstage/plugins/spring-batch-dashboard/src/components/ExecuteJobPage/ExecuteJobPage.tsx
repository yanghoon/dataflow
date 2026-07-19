import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Button,
  Grid,
  MenuItem,
  TextField,
  Typography,
  IconButton,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import {
  Content,
  Header,
  InfoCard,
  Page,
  Progress,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { springBatchUpstreamApiRef } from '../../api';
import type { Environment, JobNameInfo } from '../../types';
import { Alert } from '@mui/material';

export const ExecuteJobPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const upstreamApi = useApi(springBatchUpstreamApiRef);
  
  const environment = (searchParams.get('environment') as Environment) || 'dev';
  
  const [jobNames, setJobNames] = useState<JobNameInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedJob, setSelectedJob] = useState('');
  const [jobParams, setJobParams] = useState<Array<{ key: string; value: string }>>([
    { key: '', value: '' },
  ]);

  useEffect(() => {
    const fetchJobNames = async () => {
      try {
        console.log('[ExecuteJobPage] fetchJobNames called with environment:', environment);
        setLoading(true);
        const fetchedJobNames = await upstreamApi.getJobNames(environment);
        console.log('[ExecuteJobPage] fetchJobNames result:', fetchedJobNames);
        setJobNames(fetchedJobNames);
        if (fetchedJobNames.length > 0) {
          setSelectedJob(fetchedJobNames[0].jobName);
        }
      } catch (err: any) {
        console.error('[ExecuteJobPage] fetchJobNames error:', err);
        setError(err.message || 'Failed to fetch job list');
      } finally {
        setLoading(false);
      }
    };

    fetchJobNames();
  }, [upstreamApi, environment]);

  const handleAddParam = () => {
    setJobParams([...jobParams, { key: '', value: '' }]);
  };

  const handleRemoveParam = (index: number) => {
    setJobParams(jobParams.filter((_, i) => i !== index));
  };

  const handleParamChange = (index: number, field: 'key' | 'value', value: string) => {
    const newParams = [...jobParams];
    newParams[index][field] = value;
    setJobParams(newParams);
  };

  const handleExecute = async () => {
    if (!selectedJob) {
      setError('Please select a job name');
      return;
    }

    // Convert array of params to object
    const paramsObject: Record<string, string> = {};
    for (const param of jobParams) {
      if (param.key.trim()) {
        paramsObject[param.key.trim()] = param.value;
      }
    }

    try {
      setExecuting(true);
      setError(null);
      setSuccess(null);
      
      // Call the API to execute the job
      await upstreamApi.executeJob(selectedJob, paramsObject, environment);
      
      setSuccess(`Job ${selectedJob} triggered successfully`);
      
      // Redirect to main dashboard after a short delay
      setTimeout(() => {
        navigate(-1);
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to execute job');
    } finally {
      setExecuting(false);
    }
  };

  if (loading) {
    return (
      <Page themeId="tool">
        <Header title="Execute Job" subtitle="Trigger a new Spring Batch job execution" />
        <Content>
          <Progress />
        </Content>
      </Page>
    );
  }

  return (
    <Page themeId="tool">
      <Header title="Execute Job" subtitle="Trigger a new Spring Batch job execution" />
      <Content>
        <Box sx={{ mb: 3 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        <InfoCard title="Job Configuration">
          <Box component="form" noValidate autoComplete="off">
            <TextField
              select
              fullWidth
              label="Job Name"
              value={selectedJob}
              onChange={e => setSelectedJob(e.target.value)}
              sx={{ mb: 4 }}
            >
              {jobNames.map(job => (
                <MenuItem key={job.jobName} value={job.jobName}>
                  {job.displayName}
                </MenuItem>
              ))}
            </TextField>

            <Typography variant="h6" sx={{ mb: 2 }}>
              Job Parameters
            </Typography>

            {jobParams.map((param, index) => (
              <Grid container spacing={2} key={index} alignItems="center" sx={{ mb: 2 }}>
                <Grid item xs={5}>
                  <TextField
                    fullWidth
                    label="Key"
                    size="small"
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
                    value={param.value}
                    onChange={e => handleParamChange(index, 'value', e.target.value)}
                    placeholder="e.g. 2023-10-01"
                  />
                </Grid>
                <Grid item xs={1}>
                  <IconButton
                    color="error"
                    onClick={() => handleRemoveParam(index)}
                    disabled={jobParams.length === 1 && !param.key && !param.value}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            ))}

            <Button
              startIcon={<AddIcon />}
              onClick={handleAddParam}
              sx={{ mb: 4 }}
            >
              Add Parameter
            </Button>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 4 }}>
              <Button
                variant="contained"
                color="primary"
                startIcon={<PlayArrowIcon />}
                onClick={handleExecute}
                disabled={executing || !selectedJob}
              >
                {executing ? 'Executing...' : 'Execute'}
              </Button>
            </Box>
          </Box>
        </InfoCard>
      </Content>
    </Page>
  );
};
