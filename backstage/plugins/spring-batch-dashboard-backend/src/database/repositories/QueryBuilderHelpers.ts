import type { Knex } from 'knex';

/**
 * Query builder helper for handling Boot 3 and Boot 4 queries
 */
export class QueryBuilderHelpers {
  private knex?: Knex;
  private tableCache?: {
    hasBoot3: boolean;
    hasBoot4: boolean;
    hasDefault: boolean;
  };

  /**
   * Set Knex instance for table detection
   */
  setKnex(knex: Knex): void {
    this.knex = knex;
  }

  /**
   * Check which Spring Batch table versions exist
   */
  private async detectTables(): Promise<{
    hasBoot3: boolean;
    hasBoot4: boolean;
    hasDefault: boolean;
  }> {
    if (this.tableCache) {
      return this.tableCache;
    }

    if (!this.knex) {
      // Fallback: assume default tables exist
      this.tableCache = { hasBoot3: false, hasBoot4: false, hasDefault: true };
      return this.tableCache;
    }

    try {
      const [boot3, boot4, defaultTable] = await Promise.all([
        this.knex.schema
          .hasTable('boot3_batch_job_execution')
          .catch(() => false),
        this.knex.schema
          .hasTable('boot4_batch_job_execution')
          .catch(() => false),
        this.knex.schema
          .hasTable('batch_job_execution')
          .catch(() => false),
      ]);

      this.tableCache = {
        hasBoot3: boot3 as boolean,
        hasBoot4: boot4 as boolean,
        hasDefault: defaultTable as boolean,
      };

      return this.tableCache;
    } catch (error) {
      // If detection fails, assume default tables exist
      this.tableCache = { hasBoot3: false, hasBoot4: false, hasDefault: true };
      return this.tableCache;
    }
  }

  /**
   * Execute the same query for both Boot 3 and Boot 4 tables (or default table)
   * Returns merged and sorted results
   */
  async queryBothVersions<T>(
    buildQuery: (tablePrefix: string, bootVersion: string) => Knex.QueryBuilder,
    sortFn?: (a: T, b: T) => number,
    options?: {
      fetchLimit?: number;
      offset?: number;
      limit?: number;
    },
  ): Promise<T[]> {
    const tables = await this.detectTables();
    const queries: Promise<T[]>[] = [];

    // Query boot3 tables if they exist
    if (tables.hasBoot3) {
      queries.push(buildQuery('boot3_', 'Boot3'));
    }

    // Query boot4 tables if they exist
    if (tables.hasBoot4) {
      queries.push(buildQuery('boot4_', 'Boot4'));
    }

    // Query default tables if no boot tables exist
    if (!tables.hasBoot3 && !tables.hasBoot4 && tables.hasDefault) {
      queries.push(buildQuery('', 'Default'));
    }

    // Execute all queries in parallel
    const results = await Promise.all(queries);
    let allResults = results.flat();

    if (sortFn) {
      allResults.sort(sortFn);
    }

    // Apply offset and limit if provided
    if (options?.offset !== undefined || options?.limit !== undefined) {
      const offset = options?.offset || 0;
      const limit = options.limit || allResults.length;
      allResults = allResults.slice(offset, offset + limit);
    }

    return allResults;
  }

  /**
   * Apply common filters to a query
   */
  applyFilters(
    query: Knex.QueryBuilder,
    filters: Record<string, any>,
    fieldMappings: Record<string, string>,
  ): Knex.QueryBuilder {
    let result = query;

    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && fieldMappings[key]) {
        const field = fieldMappings[key];
        const operator =
          key.endsWith('From') || key.endsWith('_from')
            ? '>='
            : key.endsWith('To') || key.endsWith('_to')
              ? '<='
              : '=';

        if (operator === '=') {
          result = result.where(field, value);
        } else {
          result = result.where(field, operator, value);
        }
      }
    });

    return result;
  }

  /**
   * Apply standard job execution filters
   */
  applyExecutionFilters(
    query: Knex.QueryBuilder,
    filters: {
      status?: string;
      jobName?: string;
      from?: string;
      to?: string;
    },
  ): Knex.QueryBuilder {
    let result = query;

    if (filters.status) {
      result = result.where('e.status', filters.status);
    }

    if (filters.jobName) {
      result = result.where('i.job_name', filters.jobName);
    }

    if (filters.from) {
      const fromTimestamp = `${filters.from} 00:00:00`;
      result = result.where('e.start_time', '>=', fromTimestamp);
    }

    if (filters.to) {
      const toTimestamp = `${filters.to} 23:59:59.999`;
      result = result.where('e.start_time', '<=', toTimestamp);
    }

    return result;
  }

  /**
   * Join job instance table
   */
  joinJobInstance(
    query: Knex.QueryBuilder,
    tablePrefix: string,
  ): Knex.QueryBuilder {
    return query.join(
      `${tablePrefix}batch_job_instance as i`,
      'e.job_instance_id',
      'i.job_instance_id',
    );
  }

  /**
   * Apply date range filter using DATE() function
   */
  applyDateRangeFilter(
    query: Knex.QueryBuilder,
    dateField: string,
    date?: string,
    fromDate?: string,
    toDate?: string,
  ): Knex.QueryBuilder {
    let result = query;

    if (date) {
      result = result.whereRaw(`DATE(${dateField}) = ?`, [date]);
    } else {
      if (fromDate) {
        result = result.whereRaw(`DATE(${dateField}) >= ?`, [fromDate]);
      }
      if (toDate) {
        result = result.whereRaw(`DATE(${dateField}) <= ?`, [toDate]);
      }
    }

    return result;
  }

  /**
   * Apply date range filter optimized for index usage
   * Converts date strings to timestamp ranges instead of using DATE() function
   */
  applyDateRangeFilterOptimized(
    query: Knex.QueryBuilder,
    dateField: string,
    date?: string,
    fromDate?: string,
    toDate?: string,
  ): Knex.QueryBuilder {
    let result = query;

    if (date) {
      // Single date: from 00:00:00 to 23:59:59.999
      const startOfDay = `${date} 00:00:00`;
      const endOfDay = `${date} 23:59:59.999`;
      result = result
        .where(dateField, '>=', startOfDay)
        .where(dateField, '<=', endOfDay);
    } else {
      if (fromDate) {
        result = result.where(dateField, '>=', `${fromDate} 00:00:00`);
      }
      if (toDate) {
        result = result.where(dateField, '<=', `${toDate} 23:59:59.999`);
      }
    }

    return result;
  }

  /**
   * Merge aggregated data from Boot 3 and Boot 4
   * Used for statistics that need to be summed
   */
  mergeAggregatedData<T extends Record<string, any>>(
    boot3Data: T[],
    boot4Data: T[],
    keyExtractor: (row: T) => string,
    numericFields: string[],
  ): T[] {
    const dataMap = new Map<string, any>();

    [...boot3Data, ...boot4Data].forEach(row => {
      const key = keyExtractor(row);
      const existing = dataMap.get(key);

      if (!existing) {
        dataMap.set(key, { ...row });
      } else {
        numericFields.forEach(field => {
          existing[field] = (existing[field] || 0) + (row[field] || 0);
        });
      }
    });

    return Array.from(dataMap.values()) as T[];
  }

  /**
   * Safe integer parsing
   */
  parseIntSafe(value: any, defaultValue: number = 0): number {
    const parsed = parseInt(String(value), 10);
    return Number.isNaN(parsed) ? defaultValue : parsed;
  }
}
