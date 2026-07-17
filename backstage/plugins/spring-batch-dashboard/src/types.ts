// Environment is now dynamic - loaded from backend API
export type Environment = string;

// JobStatus is now a string to allow any status from the database
// Common values: 'COMPLETED', 'STARTED', 'FAILED', 'STOPPED', 'ABANDONED', 'UNKNOWN'
export type JobStatus = string;

export interface JobParameter {
  jobExecutionId: number;
  parameterName: string;
  parameterType: string;
  parameterValue: string;
  identifying: string;
}

export interface StepExecution {
  stepExecutionId: number;
  version: number;
  stepName: string;
  jobExecutionId: number;
  createTime: Date;
  startTime: Date | null;
  endTime: Date | null;
  status: string;
  commitCount: number;
  readCount: number;
  filterCount: number;
  writeCount: number;
  readSkipCount: number;
  writeSkipCount: number;
  processSkipCount: number;
  rollbackCount: number;
  exitCode: string | null;
  exitMessage: string | null;
  lastUpdated: Date;
  bootVersion?: 'Boot3' | 'Boot4';
}

export interface JobExecution {
  jobExecutionId: number;
  version: number;
  jobInstanceId: number;
  createTime: Date;
  startTime: Date | null;
  endTime: Date | null;
  status: JobStatus;
  exitCode: string | null;
  exitMessage: string | null;
  lastUpdated: Date;
  jobName?: string;
  bootVersion?: 'Boot3' | 'Boot4'; // Spring Boot version identifier
  parameters?: JobParameter[];
  steps?: StepExecution[];
}

export interface JobInstance {
  jobInstanceId: number;
  version: number;
  jobName: string;
  jobKey: string;
}

export interface JobInstanceWithStats {
  jobInstanceId: number;
  version: number;
  jobName: string;
  jobKey: string;
  executionCount: number;
  lastExecutionStatus: JobStatus;
  lastExecutionTime: Date | null;
  bootVersion?: 'Boot3' | 'Boot4';
}

export interface JobStatistics {
  totalJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  statusBreakdown: Record<string, number>;
  recentExecutions: JobExecution[];
}

export interface JobExecutionQuery {
  limit?: number;
  offset?: number;
  status?: JobStatus;
  jobName?: string;
  from?: string;
  to?: string;
}

export interface DailyStatistics {
  date: string;
  totalExecutions: number;
  completedExecutions: number;
  failedExecutions: number;
  runningExecutions: number;
  totalJobs: number;
}

export interface DailyJobSummary {
  jobName: string;
  totalExecutions: number;
  successCount: number;
  failureCount: number;
  runningCount: number;
  avgDurationMs: number | null;
  lastStatus: JobStatus;
  lastExecutionTime: Date | null;
  bootVersion?: 'Boot3' | 'Boot4';
  lastJobInstanceId?: number | null;
}

export interface DailyTrendData {
  date: string;
  total: number;
  completed: number;
  failed: number;
  running: number;
}
