import type { Knex } from 'knex';
import type {
  JobExecution,
  JobInstance,
  JobInstanceWithStats,
  JobStatistics,
  JobExecutionQuery,
  DailyStatistics,
  DailyJobSummary,
  DailyTrendData,
} from '../../types';
import { QueryConstants } from './QueryConstants';
import { QueryBuilderHelpers } from './QueryBuilderHelpers';

export class BatchRepository {
  private helpers: QueryBuilderHelpers;

  constructor(private knex: Knex) {
    this.helpers = new QueryBuilderHelpers();
    this.helpers.setKnex(knex);
  }

  async getJobExecutions(
    query: JobExecutionQuery = {},
    bootVersion?: 'Boot3' | 'Boot4' | 'Default',
  ): Promise<JobExecution[]> {
    const { limit = 50, offset = 0, status, jobName, from, to } = query;

    if (bootVersion) {
      const tablePrefix = bootVersion === 'Boot3' ? 'boot3_' : bootVersion === 'Boot4' ? 'boot4_' : '';
      let q = this.knex(`${tablePrefix}batch_job_execution as e`);
      q = this.helpers.joinJobInstance(q, tablePrefix);
      q = q.select(
        QueryConstants.getJobExecutionColumns(this.knex, bootVersion),
      );
      q = this.helpers.applyExecutionFilters(q, { status, jobName, from, to });
      q = q.orderBy('e.create_time', 'desc');
      q = q.limit(limit);
      q = q.offset(offset);
      return await q;
    }

    // Fetch limit + offset from each version to ensure we have enough data
    // after merging and sorting (optimization to avoid fetching all records)
    const fetchLimit = limit + offset;

    // Use query builder helper to query both versions
    return await this.helpers.queryBothVersions<JobExecution>(
      (tablePrefix, bootVersion) => {
        let q = this.knex(`${tablePrefix}batch_job_execution as e`);
        q = this.helpers.joinJobInstance(q, tablePrefix);
        q = q.select(
          QueryConstants.getJobExecutionColumns(this.knex, bootVersion),
        );
        q = this.helpers.applyExecutionFilters(q, {
          status,
          jobName,
          from,
          to,
        });
        q = q.orderBy('e.create_time', 'desc');
        q = q.limit(fetchLimit);
        return q;
      },
      (a, b) => {
        const dateA = new Date(a.createTime).getTime();
        const dateB = new Date(b.createTime).getTime();
        return dateB - dateA;
      },
      { offset, limit },
    );
  }

  async getJobExecutionDetail(
    executionId: number,
    bootVersion?: 'Boot3' | 'Boot4' | 'Default',
  ): Promise<JobExecution | null> {
    let execution: any;
    let tablePrefix: string = '';
    let resolvedBootVersion: string = 'Default';

    // If bootVersion is specified, query only that table
    if (bootVersion) {
      tablePrefix = bootVersion === 'Boot3' ? 'boot3_' : bootVersion === 'Boot4' ? 'boot4_' : '';
      resolvedBootVersion = bootVersion;

      execution = await this.knex(`${tablePrefix}batch_job_execution as e`)
        .join(
          `${tablePrefix}batch_job_instance as i`,
          'e.job_instance_id',
          'i.job_instance_id',
        )
        .select(
          QueryConstants.getJobExecutionColumns(this.knex, resolvedBootVersion),
        )
        .where('e.job_execution_id', executionId)
        .first();

      if (!execution) {
        return null;
      }
    } else {
      const tables = await this.helpers.detectTables();

      // Try Boot 3 first
      if (tables.hasBoot3) {
        execution = await this.knex('boot3_batch_job_execution as e')
          .join(
            'boot3_batch_job_instance as i',
            'e.job_instance_id',
            'i.job_instance_id',
          )
          .select(QueryConstants.getJobExecutionColumns(this.knex, 'Boot3'))
          .where('e.job_execution_id', executionId)
          .first();

        if (execution) {
          tablePrefix = 'boot3_';
          resolvedBootVersion = 'Boot3';
        }
      }

      // If not found, try Boot 4
      if (!execution && tables.hasBoot4) {
        execution = await this.knex('boot4_batch_job_execution as e')
          .join(
            'boot4_batch_job_instance as i',
            'e.job_instance_id',
            'i.job_instance_id',
          )
          .select(QueryConstants.getJobExecutionColumns(this.knex, 'Boot4'))
          .where('e.job_execution_id', executionId)
          .first();

        if (execution) {
          tablePrefix = 'boot4_';
          resolvedBootVersion = 'Boot4';
        }
      }

      // If still not found, try Default
      if (!execution && tables.hasDefault) {
        execution = await this.knex('batch_job_execution as e')
          .join(
            'batch_job_instance as i',
            'e.job_instance_id',
            'i.job_instance_id',
          )
          .select(QueryConstants.getJobExecutionColumns(this.knex, 'Default'))
          .where('e.job_execution_id', executionId)
          .first();

        if (execution) {
          tablePrefix = '';
          resolvedBootVersion = 'Default';
        }
      }

      if (!execution) {
        return null;
      }
    }

    // Query steps and parameters from the correct version
    const [steps, parameters] = await Promise.all([
      this.knex(`${tablePrefix}batch_step_execution`)
        .select(
          QueryConstants.getStepExecutionColumns(
            this.knex,
            resolvedBootVersion,
          ),
        )
        .where('job_execution_id', executionId)
        .orderBy('step_execution_id'),
      this.knex(`${tablePrefix}batch_job_execution_params`)
        .select(
          'job_execution_id as jobExecutionId',
          'parameter_name as parameterName',
          'parameter_type as parameterType',
          'parameter_value as parameterValue',
          'identifying as identifying',
        )
        .where('job_execution_id', executionId),
    ]);

    return {
      ...execution,
      steps,
      parameters,
    };
  }

  async getStepExecutionDetail(
    stepExecutionId: number,
    bootVersion?: 'Boot3' | 'Boot4' | 'Default',
  ): Promise<any | null> {
    // If bootVersion is specified, query only that table
    if (bootVersion) {
      const tablePrefix = bootVersion === 'Boot3' ? 'boot3_' : bootVersion === 'Boot4' ? 'boot4_' : '';
      const step = await this.knex(`${tablePrefix}batch_step_execution`)
        .select(QueryConstants.getStepExecutionColumns(this.knex, bootVersion))
        .where('step_execution_id', stepExecutionId)
        .first();

      return step || null;
    }

    // Otherwise, try Boot 3 first, then Boot 4, then Default
    const tables = await this.helpers.detectTables();
    let step = null;

    if (tables.hasBoot3) {
      step = await this.knex('boot3_batch_step_execution')
        .select(QueryConstants.getStepExecutionColumns(this.knex, 'Boot3'))
        .where('step_execution_id', stepExecutionId)
        .first();
      if (step) return step;
    }

    if (tables.hasBoot4) {
      step = await this.knex('boot4_batch_step_execution')
        .select(QueryConstants.getStepExecutionColumns(this.knex, 'Boot4'))
        .where('step_execution_id', stepExecutionId)
        .first();
      if (step) return step;
    }

    if (tables.hasDefault) {
      step = await this.knex('batch_step_execution')
        .select(QueryConstants.getStepExecutionColumns(this.knex, 'Default'))
        .where('step_execution_id', stepExecutionId)
        .first();
      if (step) return step;
    }

    return null;
  }

  async getJobExecutionsByName(
    jobName: string,
    limit: number = 20,
  ): Promise<JobExecution[]> {
    const allExecutions = await this.helpers.queryBothVersions<JobExecution>(
      (tablePrefix, bootVersion) => {
        let q = this.knex(`${tablePrefix}batch_job_execution as e`);
        q = this.helpers.joinJobInstance(q, tablePrefix);
        q = q.select(
          QueryConstants.getJobExecutionColumns(this.knex, bootVersion),
        );
        q = q.where('i.job_name', jobName);
        return q;
      },
      (a, b) => {
        const dateA = new Date(a.createTime).getTime();
        const dateB = new Date(b.createTime).getTime();
        return dateB - dateA;
      },
    );

    return allExecutions.slice(0, limit);
  }

  async getJobExecutionsWithSteps(
    jobName: string,
    limit: number = 10,
  ): Promise<JobExecution[]> {
    const executions = await this.getJobExecutionsByName(jobName, limit);

    const executionIds = executions.map(e => e.jobExecutionId);

    if (executionIds.length === 0) {
      return [];
    }

    // Query steps from both Boot 3 and Boot 4
    const allSteps = await this.helpers.queryBothVersions<any>(tablePrefix => {
      return this.knex(`${tablePrefix}batch_step_execution`)
        .select(QueryConstants.getStepExecutionColumns())
        .whereIn('job_execution_id', executionIds)
        .orderBy('step_execution_id');
    });

    // Map steps to each execution
    return executions.map(execution => ({
      ...execution,
      steps: allSteps.filter(
        step => step.jobExecutionId === execution.jobExecutionId,
      ),
    }));
  }

  async getJobs(): Promise<JobInstance[]> {
    const tables = await this.helpers.detectTables();
    const queries: any[] = [];

    const selectColumns = [
      'job_instance_id as jobInstanceId',
      'version as version',
      'job_name as jobName',
      'job_key as jobKey',
    ];

    if (tables.hasBoot3) {
      queries.push(this.knex('boot3_batch_job_instance').select(selectColumns));
    }
    if (tables.hasBoot4) {
      queries.push(this.knex('boot4_batch_job_instance').select(selectColumns));
    }
    if (tables.hasDefault) {
      queries.push(this.knex('batch_job_instance').select(selectColumns));
    }

    if (queries.length === 0) return [];

    let combined = queries[0];
    for (let i = 1; i < queries.length; i++) {
      combined = combined.union([queries[i]]);
    }

    return await this.knex
      .select('*')
      .from(this.knex.raw('(?) as combined', [combined]))
      .distinct('jobName')
      .orderBy('jobName');
  }

  async getStatistics(): Promise<JobStatistics> {
    const tables = await this.helpers.detectTables();
    
    const statsPromises: Promise<any>[] = [];
    const breakdownPromises: Promise<any>[] = [];

    const pushPromises = (tablePrefix: string) => {
      statsPromises.push(
        this.knex(`${tablePrefix}batch_job_execution`)
          .select(
            this.knex.raw('count(*) as total_jobs'),
            ...QueryConstants.buildStatusAggregation(this.knex),
          )
          .first()
      );
      breakdownPromises.push(
        this.knex(`${tablePrefix}batch_job_execution`)
          .select('status')
          .count('* as count')
          .groupBy('status')
      );
    };

    if (tables.hasBoot3) pushPromises('boot3_');
    if (tables.hasBoot4) pushPromises('boot4_');
    if (tables.hasDefault) pushPromises('');

    const statsResults = await Promise.all(statsPromises);
    const breakdownResults = await Promise.all(breakdownPromises);

    const statusMap: Record<string, number> = {};
    breakdownResults.flat().forEach((row: any) => {
      if (row.status) {
        statusMap[row.status] = (statusMap[row.status] || 0) + this.helpers.parseIntSafe(row.count);
      }
    });

    const recentExecutions = await this.getJobExecutions({ limit: 10 });

    let totalJobs = 0, runningJobs = 0, completedJobs = 0, failedJobs = 0;
    statsResults.forEach(stat => {
      if (stat) {
        totalJobs += this.helpers.parseIntSafe(stat.total_jobs);
        runningJobs += this.helpers.parseIntSafe(stat.running);
        completedJobs += this.helpers.parseIntSafe(stat.completed);
        failedJobs += this.helpers.parseIntSafe(stat.failed);
      }
    });

    return {
      totalJobs,
      runningJobs,
      completedJobs,
      failedJobs,
      statusBreakdown: statusMap,
      recentExecutions,
    };
  }

  async getDailyStatistics(date: string): Promise<DailyStatistics> {
    const startOfDay = `${date} 00:00:00`;
    const endOfDay = `${date} 23:59:59.999`;
    const tables = await this.helpers.detectTables();
    const statsPromises: Promise<any>[] = [];

    const pushPromise = (tablePrefix: string) => {
      statsPromises.push(
        this.knex(`${tablePrefix}batch_job_execution`)
          .select(
            this.knex.raw('count(*) as total_executions'),
            this.knex.raw("sum(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_executions"),
            this.knex.raw("sum(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed_executions"),
            this.knex.raw("sum(CASE WHEN status = 'STARTED' THEN 1 ELSE 0 END) as running_executions"),
            this.knex.raw('count(DISTINCT job_instance_id) as total_jobs'),
          )
          .where('start_time', '>=', startOfDay)
          .where('start_time', '<=', endOfDay)
          .first()
      );
    };

    if (tables.hasBoot3) pushPromise('boot3_');
    if (tables.hasBoot4) pushPromise('boot4_');
    if (tables.hasDefault) pushPromise('');

    const statsResults = await Promise.all(statsPromises);
    
    let totalExecutions = 0, completedExecutions = 0, failedExecutions = 0, runningExecutions = 0, totalJobs = 0;
    statsResults.forEach(stat => {
      if (stat) {
        totalExecutions += this.helpers.parseIntSafe(stat.total_executions);
        completedExecutions += this.helpers.parseIntSafe(stat.completed_executions);
        failedExecutions += this.helpers.parseIntSafe(stat.failed_executions);
        runningExecutions += this.helpers.parseIntSafe(stat.running_executions);
        totalJobs += this.helpers.parseIntSafe(stat.total_jobs);
      }
    });

    return {
      date,
      totalExecutions,
      completedExecutions,
      failedExecutions,
      runningExecutions,
      totalJobs,
    };
  }

  async getDailyJobSummaries(date: string): Promise<DailyJobSummary[]> {
    const startOfDay = `${date} 00:00:00`;
    const endOfDay = `${date} 23:59:59.999`;
    const tables = await this.helpers.detectTables();

    const buildSummaryQuery = (tablePrefix: string, bootVersion: string) => {
      return this.knex(`${tablePrefix}batch_job_execution as e`)
        .join(
          `${tablePrefix}batch_job_instance as i`,
          'e.job_instance_id',
          'i.job_instance_id',
        )
        .select(
          'i.job_name as jobName',
          this.knex.raw('count(*) as total_executions'),
          this.knex.raw("sum(CASE WHEN e.status = 'COMPLETED' THEN 1 ELSE 0 END) as success_count"),
          this.knex.raw("sum(CASE WHEN e.status = 'FAILED' THEN 1 ELSE 0 END) as failure_count"),
          this.knex.raw("sum(CASE WHEN e.status = 'STARTED' THEN 1 ELSE 0 END) as running_count"),
          QueryConstants.buildAvgDuration(this.knex, 'avg_duration_ms'),
          this.knex.raw(`
            (SELECT e2.status FROM ${tablePrefix}batch_job_execution e2
             INNER JOIN ${tablePrefix}batch_job_instance i2 ON e2.job_instance_id = i2.job_instance_id
             WHERE i2.job_name = i.job_name
             ORDER BY e2.create_time DESC LIMIT 1) as last_status
          `),
          this.knex.raw(`
            (SELECT e2.start_time FROM ${tablePrefix}batch_job_execution e2
             INNER JOIN ${tablePrefix}batch_job_instance i2 ON e2.job_instance_id = i2.job_instance_id
             WHERE i2.job_name = i.job_name
             ORDER BY e2.create_time DESC LIMIT 1) as last_execution_time
          `),
          this.knex.raw(`
            (SELECT i2.job_instance_id FROM ${tablePrefix}batch_job_execution e2
             INNER JOIN ${tablePrefix}batch_job_instance i2 ON e2.job_instance_id = i2.job_instance_id
             WHERE i2.job_name = i.job_name
             ORDER BY e2.create_time DESC LIMIT 1) as last_job_instance_id
          `),
          this.knex.raw(`'${bootVersion}' as boot_version`),
        )
        .where('e.start_time', '>=', startOfDay)
        .where('e.start_time', '<=', endOfDay)
        .groupBy('i.job_name');
    };

    const summaryPromises = [];
    if (tables.hasBoot3) summaryPromises.push(buildSummaryQuery('boot3_', 'Boot3'));
    if (tables.hasBoot4) summaryPromises.push(buildSummaryQuery('boot4_', 'Boot4'));
    if (tables.hasDefault) summaryPromises.push(buildSummaryQuery('', 'Default'));

    const summaryResults = await Promise.all(summaryPromises);
    const summaryMap = new Map<string, any>();

    summaryResults.flat().forEach((row: any) => {
      const existing = summaryMap.get(row.jobName);
      if (!existing) {
        summaryMap.set(row.jobName, { ...row });
      } else {
        const existingCount = this.helpers.parseIntSafe(existing.total_executions);
        const newCount = this.helpers.parseIntSafe(row.total_executions);
        const existingAvg = parseFloat(existing.avg_duration_ms) || 0;
        const newAvg = parseFloat(row.avg_duration_ms) || 0;
        const totalCount = existingCount + newCount;

        existing.total_executions = totalCount;
        existing.success_count = this.helpers.parseIntSafe(existing.success_count) + this.helpers.parseIntSafe(row.success_count);
        existing.failure_count = this.helpers.parseIntSafe(existing.failure_count) + this.helpers.parseIntSafe(row.failure_count);
        existing.running_count = this.helpers.parseIntSafe(existing.running_count) + this.helpers.parseIntSafe(row.running_count);
        existing.avg_duration_ms = totalCount > 0 ? (existingAvg * existingCount + newAvg * newCount) / totalCount : null;

        const existingTime = existing.last_execution_time ? new Date(existing.last_execution_time) : null;
        const newTime = row.last_execution_time ? new Date(row.last_execution_time) : null;
        if (newTime && (!existingTime || newTime > existingTime)) {
          existing.last_status = row.last_status;
          existing.last_execution_time = row.last_execution_time;
          existing.boot_version = row.boot_version;
          existing.last_job_instance_id = row.last_job_instance_id;
        }
      }
    });

    return Array.from(summaryMap.values())
      .map((row: any) => ({
        jobName: row.jobName,
        totalExecutions: this.helpers.parseIntSafe(row.total_executions),
        successCount: this.helpers.parseIntSafe(row.success_count),
        failureCount: this.helpers.parseIntSafe(row.failure_count),
        runningCount: this.helpers.parseIntSafe(row.running_count),
        avgDurationMs: row.avg_duration_ms ? parseFloat(row.avg_duration_ms) : null,
        lastStatus: row.last_status,
        lastExecutionTime: row.last_execution_time,
        bootVersion: row.boot_version,
        lastJobInstanceId: row.last_job_instance_id ? this.helpers.parseIntSafe(row.last_job_instance_id) : null,
      }))
      .sort((a, b) => a.jobName.localeCompare(b.jobName));
  }

  async getJobInstanceExecutions(
    jobInstanceId: number,
    bootVersion?: 'Boot3' | 'Boot4' | 'Default',
  ): Promise<JobExecution[]> {
    if (bootVersion) {
      const tablePrefix = bootVersion === 'Boot3' ? 'boot3_' : bootVersion === 'Boot4' ? 'boot4_' : '';
      let q = this.knex(`${tablePrefix}batch_job_execution as e`);
      q = this.helpers.joinJobInstance(q, tablePrefix);
      q = q.select(
        QueryConstants.getJobExecutionColumns(this.knex, bootVersion),
      );
      q = q.where('e.job_instance_id', jobInstanceId);
      q = q.orderBy('e.create_time', 'desc');
      return await q;
    }

    const allExecutions = await this.helpers.queryBothVersions<JobExecution>(
      (tablePrefix, bootVersion) => {
        let q = this.knex(`${tablePrefix}batch_job_execution as e`);
        q = this.helpers.joinJobInstance(q, tablePrefix);
        q = q.select(
          QueryConstants.getJobExecutionColumns(this.knex, bootVersion),
        );
        q = q.where('e.job_instance_id', jobInstanceId);
        q = q.orderBy('e.create_time', 'desc');
        return q;
      },
    );

    return allExecutions;
  }

  async getTrendData(
    fromDate: string,
    toDate: string,
  ): Promise<DailyTrendData[]> {
    const startRange = `${fromDate} 00:00:00`;
    const endRange = `${toDate} 23:59:59.999`;
    const tables = await this.helpers.detectTables();

    const buildTrendQuery = (tablePrefix: string) => {
      return this.knex(`${tablePrefix}batch_job_execution`)
        .select(
          this.knex.raw('DATE(start_time) as date'),
          this.knex.raw('count(*) as total'),
          this.knex.raw("sum(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completed"),
          this.knex.raw("sum(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failed"),
          this.knex.raw("sum(CASE WHEN status = 'STARTED' THEN 1 ELSE 0 END) as running"),
        )
        .where('start_time', '>=', startRange)
        .where('start_time', '<=', endRange)
        .groupByRaw('DATE(start_time)')
        .orderByRaw('DATE(start_time)');
    };

    const trendPromises = [];
    if (tables.hasBoot3) trendPromises.push(buildTrendQuery('boot3_'));
    if (tables.hasBoot4) trendPromises.push(buildTrendQuery('boot4_'));
    if (tables.hasDefault) trendPromises.push(buildTrendQuery(''));

    const trendResults = await Promise.all(trendPromises);

    let mergedData: any[] = [];
    if (trendResults.length > 0) {
       mergedData = trendResults[0];
       for (let i = 1; i < trendResults.length; i++) {
         mergedData = this.helpers.mergeAggregatedData(
           mergedData,
           trendResults[i],
           (row: any) => row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date,
           ['total', 'completed', 'failed', 'running'],
         );
       }
    }

    return mergedData
      .map((row: any) => ({
        date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : row.date,
        total: this.helpers.parseIntSafe(row.total),
        completed: this.helpers.parseIntSafe(row.completed),
        failed: this.helpers.parseIntSafe(row.failed),
        running: this.helpers.parseIntSafe(row.running),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  async getJobInstancesWithStats(): Promise<JobInstanceWithStats[]> {
    const tables = await this.helpers.detectTables();
    const promises = [];

    const buildQuery = (tablePrefix: string, bootVersion: string) => {
      return this.knex(`${tablePrefix}batch_job_instance as i`)
        .leftJoin(
          `${tablePrefix}batch_job_execution as e`,
          'i.job_instance_id',
          'e.job_instance_id',
        )
        .select(
          'i.job_instance_id as jobInstanceId',
          'i.version as version',
          'i.job_name as jobName',
          'i.job_key as jobKey',
          this.knex.raw('count(e.job_execution_id) as execution_count'),
          this.knex.raw(`
            (SELECT e2.status FROM ${tablePrefix}batch_job_execution e2
             WHERE e2.job_instance_id = i.job_instance_id
             ORDER BY e2.create_time DESC LIMIT 1) as last_execution_status
          `),
          this.knex.raw(`
            (SELECT e2.start_time FROM ${tablePrefix}batch_job_execution e2
             WHERE e2.job_instance_id = i.job_instance_id
             ORDER BY e2.create_time DESC LIMIT 1) as last_execution_time
          `),
          this.knex.raw(`'${bootVersion}' as boot_version`),
        )
        .groupBy('i.job_instance_id', 'i.version', 'i.job_name', 'i.job_key');
    };

    if (tables.hasBoot3) promises.push(buildQuery('boot3_', 'Boot3'));
    if (tables.hasBoot4) promises.push(buildQuery('boot4_', 'Boot4'));
    if (tables.hasDefault) promises.push(buildQuery('', 'Default'));

    const results = await Promise.all(promises);
    const allInstances = results.flat();

    return allInstances
      .map((row: any) => {
        const jobInstanceId = row.jobinstanceid || row.jobInstanceId;
        const version = row.version;
        const jobName = row.jobname || row.jobName;
        const jobKey = row.jobkey || row.jobKey;
        const executionCount = row.execution_count;
        const lastExecutionStatus = row.last_execution_status;
        const lastExecutionTime = row.last_execution_time;
        const bootVersion = row.boot_version;

        return {
          jobInstanceId: parseInt(jobInstanceId, 10),
          version: parseInt(version, 10),
          jobName,
          jobKey,
          executionCount: parseInt(executionCount, 10) || 0,
          lastExecutionStatus: lastExecutionStatus || null,
          lastExecutionTime: lastExecutionTime || null,
          bootVersion,
        };
      })
      .sort((a, b) => {
        if (!a.lastExecutionTime && !b.lastExecutionTime) return 0;
        if (!a.lastExecutionTime) return 1;
        if (!b.lastExecutionTime) return -1;
        return new Date(b.lastExecutionTime).getTime() - new Date(a.lastExecutionTime).getTime();
      });
  }
}
