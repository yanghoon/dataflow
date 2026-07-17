import {
  coreServices,
  createBackendPlugin,
} from '@backstage/backend-plugin-api';
import { DatabaseConnectionManager } from './database/DatabaseConnectionManager';
import { createRouter } from './service/router';

export const springBatchPlugin = createBackendPlugin({
  pluginId: 'spring-batch-dashboard',
  register(env) {
    env.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        logger: coreServices.logger,
        config: coreServices.rootConfig,
      },
      async init({ httpRouter, logger, config }) {
        logger.info('Initializing Spring Batch plugin');

        // Database 연결 관리자 생성 (모든 환경 연결)
        const connectionManager = await DatabaseConnectionManager.create(
          config,
          logger,
        );

        // Auth policy 설정 - Backstage 사용자 인증 필요
        httpRouter.addAuthPolicy({
          path: '/',
          allow: 'user-cookie',
        });

        // Router 등록
        const router = await createRouter({ logger, connectionManager });
        httpRouter.use(router);

        logger.info('Spring Batch plugin initialized successfully');
      },
    });
  },
});
