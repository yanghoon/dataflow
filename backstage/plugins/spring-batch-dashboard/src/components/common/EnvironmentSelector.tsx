import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  LinearProgress,
  CircularProgress,
} from '@mui/material';
import type { Environment } from '../../types';
import { getEnvironmentLabel, ENVIRONMENT_TOGGLE_SX } from '../../utils';

interface EnvironmentSelectorProps {
  value: Environment;
  onChange: (environment: Environment) => void;
  loading?: boolean;
  availableEnvironments?: string[];
}

export const EnvironmentSelector = ({
  value,
  onChange,
  loading = false,
  availableEnvironments,
}: EnvironmentSelectorProps) => {
  const environments =
    availableEnvironments && availableEnvironments.length > 0
      ? availableEnvironments
      : ['dev'];

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <ToggleButtonGroup
          value={value}
          exclusive
          onChange={(_, newEnv) => {
            if (newEnv !== null) onChange(newEnv);
          }}
          size="small"
          disabled={loading}
          sx={ENVIRONMENT_TOGGLE_SX}
        >
          {environments.map(env => (
            <ToggleButton key={env} value={env}>
              {getEnvironmentLabel(env)}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
        {loading && <CircularProgress size={20} thickness={4} />}
      </Box>
      {loading && <LinearProgress sx={{ mt: 1 }} />}
    </Box>
  );
};
