import type { LoggerService } from '@backstage/backend-plugin-api';
import express from 'express';
import type { DatabaseConnectionManager } from '../database/DatabaseConnectionManager';
import { BatchRepository } from '../database/repositories/BatchRepository';
import { BatchService } from './BatchService';
import type { JobExecutionQuery } from '../types';
import {
  ValidationError,
  validatePositiveInt,
  validateEnvironment,
  validateOptionalString,
  validateDate,
  validateOptionalDate,
  validateOptionalStatus,
  validateDateRange,
} from './validation';

export interface RouterOptions {
  logger: LoggerService;
  connectionManager: DatabaseConnectionManager;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, connectionManager } = options;

  const router = express.Router();
  router.use(express.json());

  const availableEnvironments = connectionManager.getAvailableEnvironments();
  const defaultEnvironment = connectionManager.getDefaultEnvironment();

  logger.info(
    `Spring Batch API router initialized with environments: ${availableEnvironments.join(', ')} (default: ${defaultEnvironment})`,
  );

  router.get('/environments', (_req, res) => {
    res.json({
      environments: availableEnvironments,
      defaultEnvironment: defaultEnvironment,
    });
  });

  const getBatchService = async (
    environment?: string,
  ): Promise<BatchService> => {
    const env = environment || defaultEnvironment;
    const knex = await connectionManager.getConnection(env);
    const repository = new BatchRepository(knex);
    return new BatchService(repository);
  };

  const asyncHandler = (
    fn: (req: express.Request, res: express.Response) => Promise<void>,
    errorMessage: string,
  ) => {
    return async (req: express.Request, res: express.Response) => {
      try {
        await fn(req, res);
      } catch (error: any) {
        if (error instanceof ValidationError) {
          logger.warn(`Validation error: ${error.message}`);
          res.status(400).json({ error: error.message });
          return;
        }

        logger.error(`${errorMessage}: ${error.message}`);
        res.status(500).json({ error: 'An internal error occurred' });
      }
    };
  };

  router.get(
    '/executions',
    asyncHandler(async (req, res) => {
      const environment = validateEnvironment(
        req.query.environment,
        availableEnvironments,
        defaultEnvironment,
      );
      const batchService = await getBatchService(environment);

      const fromDate = validateOptionalDate(req.query.from, 'from');
      const toDate = validateOptionalDate(req.query.to, 'to');

      // Validate date range if both dates are provided
      if (fromDate && toDate) {
        validateDateRange(fromDate, toDate);
      }

      const query: JobExecutionQuery = {
        limit: req.query.limit
          ? validatePositiveInt(req.query.limit, 'limit', 1, 1000)
          : 50,
        offset: req.query.offset
          ? validatePositiveInt(req.query.offset, 'offset', 0)
          : 0,
        status: validateOptionalStatus(req.query.status),
        jobName: validateOptionalString(req.query.jobName, 'jobName', 255),
        from: fromDate,
        to: toDate,
      };

      // Extract bootVersion from query params
      const bootVersionParam = req.query.bootVersion as string | undefined;
      const bootVersion =
        bootVersionParam === 'Boot3' || bootVersionParam === 'Boot4'
          ? bootVersionParam
          : undefined;

      const executions = await batchService.getJobExecutions(
        query,
        bootVersion,
      );
      res.json(executions);
    }, 'Failed to get job executions'),
  );

  router.get(
    '/executions/:id',
    asyncHandler(async (req, res) => {
      const environment = validateEnvironment(
        req.query.environment,
        availableEnvironments,
        defaultEnvironment,
      );
      const batchService = await getBatchService(environment);
      const executionId = validatePositiveInt(req.params.id, 'id');

      // Extract bootVersion from query params
      const bootVersionParam = req.query.bootVersion as string | undefined;
      const bootVersion =
        bootVersionParam === 'Boot3' || bootVersionParam === 'Boot4'
          ? bootVersionParam
          : undefined;

      const execution = await batchService.getJobExecutionDetail(
        executionId,
        bootVersion,
      );

      if (!execution) {
        res.status(404).json({ error: 'Execution not found' });
        return;
      }

      res.json(execution);
    }, 'Failed to get execution detail'),
  );

  router.get(
    '/steps/:id',
    asyncHandler(async (req, res) => {
      const environment = validateEnvironment(
        req.query.environment,
        availableEnvironments,
        defaultEnvironment,
      );
      const batchService = await getBatchService(environment);
      const stepId = validatePositiveInt(req.params.id, 'id');

      // Extract bootVersion from query params
      const bootVersionParam = req.query.bootVersion as string | undefined;
      const bootVersion =
        bootVersionParam === 'Boot3' || bootVersionParam === 'Boot4'
          ? bootVersionParam
          : undefined;

      const step = await batchService.getStepExecutionDetail(
        stepId,
        bootVersion,
      );

      if (!step) {
        res.status(404).json({ error: 'Step execution not found' });
        return;
      }

      res.json(step);
    }, 'Failed to get step detail'),
  );

  router.get(
    '/jobs',
    asyncHandler(async (req, res) => {
      const environment = validateEnvironment(
        req.query.environment,
        availableEnvironments,
        defaultEnvironment,
      );
      const includeStats = req.query.includeStats === 'true';
      const batchService = await getBatchService(environment);

      const jobs = includeStats
        ? await batchService.getJobInstancesWithStats()
        : await batchService.getJobs();

      res.json(jobs);
    }, 'Failed to get jobs'),
  );

  router.get(
    '/jobs/:name/executions',
    asyncHandler(async (req, res) => {
      const environment = validateEnvironment(
        req.query.environment,
        availableEnvironments,
        defaultEnvironment,
      );
      const batchService = await getBatchService(environment);
      const jobName = validateOptionalString(req.params.name, 'name', 255);
      if (!jobName) {
        throw new ValidationError('name is required');
      }
      const limit = req.query.limit
        ? validatePositiveInt(req.query.limit, 'limit', 1, 1000)
        : 20;
      const includeSteps = req.query.includeSteps === 'true';

      const executions = includeSteps
        ? await batchService.getJobExecutionsWithSteps(jobName, limit)
        : await batchService.getJobExecutionsByName(jobName, limit);

      res.json(executions);
    }, 'Failed to get job executions by name'),
  );

  router.get(
    '/statistics',
    asyncHandler(async (req, res) => {
      const environment = validateEnvironment(
        req.query.environment,
        availableEnvironments,
        defaultEnvironment,
      );
      const batchService = await getBatchService(environment);
      const statistics = await batchService.getStatistics();
      res.json(statistics);
    }, 'Failed to get statistics'),
  );

  router.get(
    '/daily/:date/statistics',
    asyncHandler(async (req, res) => {
      const environment = validateEnvironment(
        req.query.environment,
        availableEnvironments,
        defaultEnvironment,
      );
      const batchService = await getBatchService(environment);
      const date = validateDate(req.params.date, 'date');
      const statistics = await batchService.getDailyStatistics(date);
      res.json(statistics);
    }, 'Failed to get daily statistics'),
  );

  router.get(
    '/daily/:date/jobs',
    asyncHandler(async (req, res) => {
      const environment = validateEnvironment(
        req.query.environment,
        availableEnvironments,
        defaultEnvironment,
      );
      const batchService = await getBatchService(environment);
      const date = validateDate(req.params.date, 'date');
      const summaries = await batchService.getDailyJobSummaries(date);
      res.json(summaries);
    }, 'Failed to get daily job summaries'),
  );

  router.get(
    '/analytics/trend',
    asyncHandler(async (req, res) => {
      const environment = validateEnvironment(
        req.query.environment,
        availableEnvironments,
        defaultEnvironment,
      );
      const batchService = await getBatchService(environment);
      const fromDate = validateDate(req.query.from, 'from');
      const toDate = validateDate(req.query.to, 'to');

      validateDateRange(fromDate, toDate);

      const trendData = await batchService.getTrendData(fromDate, toDate);
      res.json(trendData);
    }, 'Failed to get trend data'),
  );

  router.get(
    '/instances/:id/executions',
    asyncHandler(async (req, res) => {
      const environment = validateEnvironment(
        req.query.environment,
        availableEnvironments,
        defaultEnvironment,
      );
      const batchService = await getBatchService(environment);
      const jobInstanceId = validatePositiveInt(req.params.id, 'id');
      const bootVersionParam = req.query.bootVersion as string | undefined;
      const bootVersion =
        bootVersionParam === 'Boot3' || bootVersionParam === 'Boot4'
          ? bootVersionParam
          : undefined;
      const executions = await batchService.getJobInstanceExecutions(
        jobInstanceId,
        bootVersion,
      );
      res.json(executions);
    }, 'Failed to get job instance executions'),
  );

  return router;
}
