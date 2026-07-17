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
  lastExecutionStatus: JobStatus | null;
  lastExecutionTime: Date | null;
  bootVersion?: 'Boot3' | 'Boot4' | 'Default';
}

export type JobStatus =
  | 'STARTING'
  | 'STARTED'
  | 'STOPPING'
  | 'STOPPED'
  | 'FAILED'
  | 'COMPLETED'
  | 'ABANDONED'
  | 'UNKNOWN';

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
  // JOIN된 데이터
  jobName?: string;
  parameters?: JobParameter[];
  steps?: StepExecution[];
}

export interface JobParameter {
  jobExecutionId: number;
  parameterName: string;
  parameterType: string;
  parameterValue: string | null;
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
  status: string | null;
  commitCount: number | null;
  readCount: number | null;
  filterCount: number | null;
  writeCount: number | null;
  readSkipCount: number | null;
  writeSkipCount: number | null;
  processSkipCount: number | null;
  rollbackCount: number | null;
  exitCode: string | null;
  exitMessage: string | null;
  lastUpdated: Date;
  bootVersion?: 'Boot3' | 'Boot4' | 'Default';
}

export interface JobStatistics {
  totalJobs: number;
  runningJobs: number;
  completedJobs: number;
  failedJobs: number;
  statusBreakdown: Record<string, number>;
  recentExecutions: JobExecution[];
}

export interface PaginationQuery {
  limit?: number;
  offset?: number;
}

export interface JobExecutionQuery extends PaginationQuery {
  status?: JobStatus;
  jobName?: string;
  from?: string; // ISO date string
  to?: string; // ISO date string
}

// Daily Dashboard Types
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
  bootVersion?: 'Boot3' | 'Boot4' | 'Default';
  lastJobInstanceId?: number | null;
}

// Analytics Types
export interface DailyTrendData {
  date: string;
  total: number;
  completed: number;
  failed: number;
  running: number;
}
