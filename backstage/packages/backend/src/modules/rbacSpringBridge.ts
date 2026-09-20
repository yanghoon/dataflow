import { createBackendModule, coreServices } from '@backstage/backend-plugin-api';
import { Router, Request, Response } from 'express';

export default createBackendModule({
  pluginId: 'permission',
  moduleId: 'rbac-spring-bridge',
  register(reg) {
    reg.registerInit({
      deps: {
        httpRouter: coreServices.httpRouter,
        config: coreServices.rootConfig,
      },
      async init({ httpRouter, config }) {
        const baseUrl = config.getOptionalString('platform.baseUrl') || 'http://localhost:8080';
        const router = Router();

        const forward = (pathFunc: (req: Request) => string) => async (req: Request, res: Response) => {
          const targetUrl = `${baseUrl}${pathFunc(req)}`;
          const options: RequestInit = {
            method: req.method,
            headers: {
              ...(req.headers as Record<string, string>),
            },
          };
          
          // Remove headers that might cause issues when proxying
          delete (options.headers as Record<string, string>)['host'];
          delete (options.headers as Record<string, string>)['content-length'];
          
          if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
            options.body = typeof req.body === 'object' ? JSON.stringify(req.body) : req.body;
            if (!(options.headers as Record<string, string>)['content-type']) {
                (options.headers as Record<string, string>)['content-type'] = 'application/json';
            }
          }

          try {
            const response = await fetch(targetUrl, options);
            
            // Pass through the status code
            res.status(response.status);
            
            // Pass through headers
            response.headers.forEach((value, key) => {
              res.setHeader(key, value);
            });

            // Send the response
            const text = await response.text();
            res.send(text);
          } catch (error) {
            res.status(502).json({ error: 'Network Error' });
          }
        };

        // Proxy endpoints
        router.get('/roles', forward(() => '/api/v1/platform/roles'));
        router.post('/roles', forward(() => '/api/v1/platform/roles'));
        
        router.put('/roles/:kind/:namespace/:name', forward(req => `/api/v1/platform/roles/${req.params.kind}/${req.params.namespace}/${req.params.name}`));
        router.delete('/roles/:kind/:namespace/:name', forward(req => `/api/v1/platform/roles/${req.params.kind}/${req.params.namespace}/${req.params.name}`));
        
        router.get('/policies', forward(() => '/api/v1/platform/role-permissions'));
        router.post('/policies', forward(() => '/api/v1/platform/role-permissions'));
        router.delete('/policies', forward(() => '/api/v1/platform/role-permissions'));
        
        router.get('/policies/:kind/:namespace/:name', forward(req => `/api/v1/platform/role-permissions?ref=${req.params.kind}/${req.params.namespace}/${req.params.name}`));
        
        router.get('/roles/conditions', forward(() => '/api/v1/platform/role-conditions'));
        router.post('/roles/conditions', forward(() => '/api/v1/platform/role-conditions'));
        
        router.get('/roles/conditions/:id', forward(req => `/api/v1/platform/role-conditions/${req.params.id}`));
        router.put('/roles/conditions/:id', forward(req => `/api/v1/platform/role-conditions/${req.params.id}`));
        router.delete('/roles/conditions/:id', forward(req => `/api/v1/platform/role-conditions/${req.params.id}`));
        
        router.get('/plugins/policies', forward(() => '/api/v1/platform/permissions'));
        router.get('/plugins/condition-rules', forward(() => '/api/v1/platform/condition-rules'));

        httpRouter.use(router);
      },
    });
  },
});
