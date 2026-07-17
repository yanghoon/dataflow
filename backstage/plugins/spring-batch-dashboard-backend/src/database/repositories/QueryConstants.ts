import type { Knex } from 'knex';

/**
 * Column selection constants for batch queries
 */

// biome-ignore lint/complexity/noStaticOnlyClass: this is a static class
export class QueryConstants {
  /**
   * Get standard job execution columns
   */
  static getJobExecutionColumns(knex: Knex, bootVersion: string): any[] {
    return [
      'e.job_execution_id as jobExecutionId',
      'e.version as version',
      'e.job_instance_id as jobInstanceId',
      knex.raw(
        `to_char(e.create_time, 'YYYY-MM-DD HH24:MI:SS') as "createTime"`,
      ),
      knex.raw(`to_char(e.start_time, 'YYYY-MM-DD HH24:MI:SS') as "startTime"`),
      knex.raw(`to_char(e.end_time, 'YYYY-MM-DD HH24:MI:SS') as "endTime"`),
      'e.status as status',
      'e.exit_code as exitCode',
      'e.exit_message as exitMessage',
      knex.raw(
        `to_char(e.last_updated, 'YYYY-MM-DD HH24:MI:SS') as "lastUpdated"`,
      ),
      'i.job_name as jobName',
      knex.raw(`'${bootVersion}' as "bootVersion"`),
    ];
  }

  /**
   * Get step execution columns
   */
  static getStepExecutionColumns(knex?: Knex, bootVersion?: string): any[] {
    if (!knex) {
      return [
        'step_execution_id as stepExecutionId',
        'version as version',
        'step_name as stepName',
        'job_execution_id as jobExecutionId',
        'create_time as createTime',
        'start_time as startTime',
        'end_time as endTime',
        'status as status',
        'commit_count as commitCount',
        'read_count as readCount',
        'filter_count as filterCount',
        'write_count as writeCount',
        'read_skip_count as readSkipCount',
        'write_skip_count as writeSkipCount',
        'process_skip_count as processSkipCount',
        'rollback_count as rollbackCount',
        'exit_code as exitCode',
        'exit_message as exitMessage',
        'last_updated as lastUpdated',
      ];
    }

    const columns: any[] = [
      'step_execution_id as stepExecutionId',
      'version as version',
      'step_name as stepName',
      'job_execution_id as jobExecutionId',
      knex.raw(`to_char(create_time, 'YYYY-MM-DD HH24:MI:SS') as "createTime"`),
      knex.raw(`to_char(start_time, 'YYYY-MM-DD HH24:MI:SS') as "startTime"`),
      knex.raw(`to_char(end_time, 'YYYY-MM-DD HH24:MI:SS') as "endTime"`),
      'status as status',
      'commit_count as commitCount',
      'read_count as readCount',
      'filter_count as filterCount',
      'write_count as writeCount',
      'read_skip_count as readSkipCount',
      'write_skip_count as writeSkipCount',
      'process_skip_count as processSkipCount',
      'rollback_count as rollbackCount',
      'exit_code as exitCode',
      'exit_message as exitMessage',
      knex.raw(
        `to_char(last_updated, 'YYYY-MM-DD HH24:MI:SS') as "lastUpdated"`,
      ),
    ];

    if (bootVersion) {
      columns.push(knex.raw(`'${bootVersion}' as "bootVersion"`));
    }

    return columns;
  }

  /**
   * Get job instance columns
   */
  static getJobInstanceColumns(knex: Knex, bootVersion?: string): any[] {
    const columns: any[] = [
      'job_instance_id as jobInstanceId',
      'version as version',
      'job_name as jobName',
      'job_key as jobKey',
    ];

    if (bootVersion) {
      columns.push(knex.raw(`'${bootVersion}' as "bootVersion"`));
    }

    return columns;
  }

  /**
   * Build status aggregation columns
   */
  static buildStatusAggregation(knex: Knex, prefix: string = ''): any[] {
    const p = prefix ? `${prefix}_` : '';
    return [
      knex.raw(
        `sum(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as "${p}completed"`,
      ),
      knex.raw(
        `sum(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as "${p}failed"`,
      ),
      knex.raw(
        `sum(CASE WHEN status = 'STARTED' THEN 1 ELSE 0 END) as "${p}running"`,
      ),
    ];
  }

  /**
   * Build average duration calculation
   */
  static buildAvgDuration(knex: Knex, alias: string = 'avg_duration_ms'): any {
    return knex.raw(`
      avg(
        CASE
          WHEN e.end_time IS NOT NULL AND e.start_time IS NOT NULL
          THEN EXTRACT(EPOCH FROM (e.end_time - e.start_time)) * 1000
          ELSE NULL
        END
      ) as "${alias}"
    `);
  }
}
