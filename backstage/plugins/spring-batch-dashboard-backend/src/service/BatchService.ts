import type { BatchRepository } from '../database/repositories/BatchRepository';
import type {
  JobExecution,
  JobInstance,
  JobInstanceWithStats,
  JobStatistics,
  JobExecutionQuery,
  DailyStatistics,
  DailyJobSummary,
  DailyTrendData,
  StepExecution,
} from '../types';

export class BatchService {
  constructor(private repository: BatchRepository) {}

  async getJobExecutions(
    query: JobExecutionQuery,
    bootVersion?: 'Boot3' | 'Boot4' | 'Default',
  ): Promise<JobExecution[]> {
    return await this.repository.getJobExecutions(query, bootVersion);
  }

  async getJobExecutionDetail(
    executionId: number,
    bootVersion?: 'Boot3' | 'Boot4' | 'Default',
  ): Promise<JobExecution | null> {
    return await this.repository.getJobExecutionDetail(
      executionId,
      bootVersion,
    );
  }

  async getStepExecutionDetail(
    stepExecutionId: number,
    bootVersion?: 'Boot3' | 'Boot4' | 'Default',
  ): Promise<StepExecution | null> {
    return await this.repository.getStepExecutionDetail(
      stepExecutionId,
      bootVersion,
    );
  }

  async getJobExecutionsByName(
    jobName: string,
    limit?: number,
  ): Promise<JobExecution[]> {
    return await this.repository.getJobExecutionsByName(jobName, limit);
  }

  async getJobs(): Promise<JobInstance[]> {
    return await this.repository.getJobs();
  }

  async getStatistics(): Promise<JobStatistics> {
    return await this.repository.getStatistics();
  }

  async getDailyStatistics(date: string): Promise<DailyStatistics> {
    return await this.repository.getDailyStatistics(date);
  }

  async getDailyJobSummaries(date: string): Promise<DailyJobSummary[]> {
    return await this.repository.getDailyJobSummaries(date);
  }

  async getTrendData(
    fromDate: string,
    toDate: string,
  ): Promise<DailyTrendData[]> {
    return await this.repository.getTrendData(fromDate, toDate);
  }

  async getJobExecutionsWithSteps(
    jobName: string,
    limit?: number,
  ): Promise<JobExecution[]> {
    return await this.repository.getJobExecutionsWithSteps(jobName, limit);
  }

  async getJobInstanceExecutions(
    jobInstanceId: number,
    bootVersion?: 'Boot3' | 'Boot4' | 'Default',
  ): Promise<JobExecution[]> {
    return await this.repository.getJobInstanceExecutions(
      jobInstanceId,
      bootVersion,
    );
  }

  async getJobInstancesWithStats(): Promise<JobInstanceWithStats[]> {
    return await this.repository.getJobInstancesWithStats();
  }
}
