import { useState } from 'react';
import type { Environment } from '../types';

interface UseEnvironmentSelectorResult {
  environment: Environment;
  setEnvironment: (env: Environment) => void;
}

/**
 * Hook for managing environment selection state
 */
export function useEnvironmentSelector(
  defaultEnvironment: Environment = 'dev',
): UseEnvironmentSelectorResult {
  const [environment, setEnvironment] =
    useState<Environment>(defaultEnvironment);

  return {
    environment,
    setEnvironment,
  };
}
