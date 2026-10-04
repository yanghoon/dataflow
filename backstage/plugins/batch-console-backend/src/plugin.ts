import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { createRouter } from './service/router';

export const batchConsolePlugin = createBackendPlugin({
  pluginId: 'batch-console',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async init({ httpRouter, logger, config }) {
        logger.info('Initializing Batch Console backend plugin');

        httpRouter.addAuthPolicy({
          path: '/',
          allow: 'user-cookie',
        });
        httpRouter.addAuthPolicy({
          path: '/',
          allow: 'unauthenticated',
        });

        const router = await createRouter({ logger, config });
        httpRouter.use(router);

        logger.info('Batch Console backend plugin initialized successfully');
      },
    });
  },
});
