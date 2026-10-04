import type { LoggerService } from '@backstage/backend-plugin-api';
import type { Config } from '@backstage/config';
import express from 'express';

export interface RouterOptions {
  logger: LoggerService;
  config: Config;
}

interface InstanceConfig {
  targetBaseUrl: string;
  headers: Record<string, string>;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, config } = options;
  const router = express.Router();
  router.use(express.json());

  const instances: Record<string, InstanceConfig> = {};
  let defaultEnvironment = '';

  const springBatchConfig = config.getOptionalConfig('springBatch');
  if (springBatchConfig) {
    defaultEnvironment =
      springBatchConfig.getOptionalString('defaultEnvironment') || '';
    const databasesConfig = springBatchConfig.getOptionalConfig('databases');
    if (databasesConfig) {
      for (const env of databasesConfig.keys()) {
        const envConfig = databasesConfig.getConfig(env);
        const url = envConfig.getOptionalString('http.url');
        if (url) {
          try {
            const origin = new URL(url).origin;
            const targetBaseUrl = `${origin}/api/batch`;
            const headers: Record<string, string> = {};
            const headersConfig = envConfig.getOptionalConfig('http.headers');
            if (headersConfig) {
              for (const headerKey of headersConfig.keys()) {
                headers[headerKey] = headersConfig.getString(headerKey);
              }
            }
            instances[env] = { targetBaseUrl, headers };
          } catch (e: any) {
            logger.warn(
              `Invalid http.url for environment '${env}': ${url} - ${e.message}`,
            );
          }
        }
      }
    }
  }

  const configuredEnvironments = Object.keys(instances);
  if (!defaultEnvironment && configuredEnvironments.length > 0) {
    defaultEnvironment = configuredEnvironments[0];
  }

  logger.info(
    `Batch Console backend router initialized with environments: [${configuredEnvironments.join(
      ', ',
    )}], default: '${defaultEnvironment}'`,
  );

  const resolveInstance = (
    req: express.Request,
    res: express.Response,
  ): InstanceConfig | null => {
    const envParam = req.query.environment as string | undefined;
    const env = envParam || defaultEnvironment;

    if (!env || !instances[env]) {
      res.status(400).json({
        error: `Unknown or unconfigured environment: ${env || '(empty)'}`,
      });
      return null;
    }

    return instances[env];
  };

  const forwardRequest = async (
    targetBasePath: string,
    req: express.Request,
    res: express.Response,
    instance: InstanceConfig,
  ) => {
    try {
      const queryParams = new URLSearchParams();
      for (const [key, value] of Object.entries(req.query)) {
        if (key !== 'environment' && value !== undefined) {
          if (Array.isArray(value)) {
            value.forEach(v => queryParams.append(key, String(v)));
          } else {
            queryParams.append(key, String(value));
          }
        }
      }
      const qs = queryParams.toString();
      const targetUrl = qs ? `${targetBasePath}?${qs}` : targetBasePath;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...instance.headers,
      };

      const fetchOptions: RequestInit = {
        method: req.method,
        headers,
      };

      if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        fetchOptions.body = JSON.stringify(req.body ?? {});
      }

      const upstreamResponse = await fetch(targetUrl, fetchOptions);
      res.status(upstreamResponse.status);

      const contentType = upstreamResponse.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await upstreamResponse.json();
        res.json(data);
      } else {
        const text = await upstreamResponse.text();
        res.send(text);
      }
    } catch (error: any) {
      logger.error(
        `Failed to forward request to ${targetBasePath}: ${error.message}`,
      );
      res.status(502).json({ error: `Bad Gateway: ${error.message}` });
    }
  };

  router.get('/environments', (_req, res) => {
    res.json({
      environments: configuredEnvironments,
      defaultEnvironment,
    });
  });

  router.get('/jobs', async (req, res) => {
    const instance = resolveInstance(req, res);
    if (!instance) return;
    await forwardRequest(`${instance.targetBaseUrl}/jobs`, req, res, instance);
  });

  router.get('/jobs/:jobName/schema', async (req, res) => {
    const instance = resolveInstance(req, res);
    if (!instance) return;
    const { jobName } = req.params;
    await forwardRequest(
      `${instance.targetBaseUrl}/jobs/${encodeURIComponent(jobName)}/schema`,
      req,
      res,
      instance,
    );
  });

  router.post('/jobs/:jobName/executions', async (req, res) => {
    const instance = resolveInstance(req, res);
    if (!instance) return;
    const { jobName } = req.params;
    await forwardRequest(
      `${instance.targetBaseUrl}/jobs/${encodeURIComponent(
        jobName,
      )}/executions`,
      req,
      res,
      instance,
    );
  });

  router.get('/schedules', async (req, res) => {
    const instance = resolveInstance(req, res);
    if (!instance) return;
    await forwardRequest(
      `${instance.targetBaseUrl}/schedules`,
      req,
      res,
      instance,
    );
  });

  router.post('/schedules', async (req, res) => {
    const instance = resolveInstance(req, res);
    if (!instance) return;
    await forwardRequest(
      `${instance.targetBaseUrl}/schedules`,
      req,
      res,
      instance,
    );
  });

  router.put('/schedules/:id', async (req, res) => {
    const instance = resolveInstance(req, res);
    if (!instance) return;
    const { id } = req.params;
    await forwardRequest(
      `${instance.targetBaseUrl}/schedules/${encodeURIComponent(id)}`,
      req,
      res,
      instance,
    );
  });

  router.delete('/schedules/:id', async (req, res) => {
    const instance = resolveInstance(req, res);
    if (!instance) return;
    const { id } = req.params;
    await forwardRequest(
      `${instance.targetBaseUrl}/schedules/${encodeURIComponent(id)}`,
      req,
      res,
      instance,
    );
  });

  return router;
}
