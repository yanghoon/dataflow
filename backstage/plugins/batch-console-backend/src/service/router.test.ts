import { mockServices } from '@backstage/backend-test-utils';
import express from 'express';
import request from 'supertest';
import { createRouter } from './router';

describe('createRouter', () => {
  let app: express.Express;
  let originalFetch: typeof global.fetch;
  const mockFetch = jest.fn();

  beforeAll(() => {
    originalFetch = global.fetch;
    global.fetch = mockFetch as any;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    const config = mockServices.rootConfig({
      data: {
        springBatch: {
          defaultEnvironment: 'dev',
          databases: {
            dev: {
              http: {
                url: 'http://localhost:8080/api/jobs',
                headers: {
                  'X-Test-Header': 'custom-val',
                },
              },
            },
            staging: {
              http: {
                url: 'http://staging-host:8080/api/jobs',
              },
            },
          },
        },
      },
    });

    const logger = mockServices.logger.mock();
    const router = await createRouter({ config, logger });
    app = express();
    app.use(router);
  });

  describe('GET /environments', () => {
    it('returns configured environments and default environment', async () => {
      const response = await request(app).get('/environments');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        environments: ['dev', 'staging'],
        defaultEnvironment: 'dev',
      });
    });
  });

  describe('Environment Validation', () => {
    it('returns 400 for unknown environment', async () => {
      const response = await request(app).get('/jobs?environment=nonexistent');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Unknown or unconfigured environment: nonexistent',
      });
    });
  });

  describe('Proxy /jobs', () => {
    it('forwards GET /jobs to target origin with headers and returns 200', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [{ name: 'testJob', restartable: true, totalExecutions: 1 }],
      });

      const response = await request(app).get('/jobs?environment=dev');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        { name: 'testJob', restartable: true, totalExecutions: 1 },
      ]);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/batch/jobs',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'X-Test-Header': 'custom-val',
          }),
        }),
      );
    });

    it('uses default environment when environment query param is omitted', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [],
      });

      const response = await request(app).get('/jobs');

      expect(response.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/batch/jobs',
        expect.anything(),
      );
    });

    it('returns 502 if upstream is unreachable', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

      const response = await request(app).get('/jobs');

      expect(response.status).toBe(502);
      expect(response.body.error).toContain('Bad Gateway: Connection refused');
    });
  });

  describe('Proxy /jobs/:jobName/schema', () => {
    it('forwards GET /jobs/:jobName/schema', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ type: 'object', properties: {} }),
      });

      const response = await request(app).get('/jobs/importUserJob/schema?environment=staging');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ type: 'object', properties: {} });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://staging-host:8080/api/batch/jobs/importUserJob/schema',
        expect.objectContaining({ method: 'GET' }),
      );
    });
  });

  describe('Proxy POST /jobs/:jobName/executions', () => {
    it('forwards execution payload to upstream', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ executionId: 101 }),
      });

      const payload = { date: '2026-10-04' };
      const response = await request(app)
        .post('/jobs/importUserJob/executions?environment=dev')
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ executionId: 101 });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/batch/jobs/importUserJob/executions',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(payload),
        }),
      );
    });
  });

  describe('Proxy Schedules', () => {
    it('forwards GET /schedules', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => [{ id: 's1', jobName: 'testJob' }],
      });

      const response = await request(app).get('/schedules?environment=dev');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([{ id: 's1', jobName: 'testJob' }]);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/batch/schedules',
        expect.objectContaining({ method: 'GET' }),
      );
    });

    it('forwards POST /schedules', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: async () => ({ id: 's2' }),
      });

      const scheduleData = {
        jobName: 'testJob',
        cronExpression: '0 0 * * * *',
        parameters: { foo: 'bar' },
      };

      const response = await request(app)
        .post('/schedules?environment=dev')
        .send(scheduleData);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: 's2' });
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/batch/schedules',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(scheduleData),
        }),
      );
    });

    it('forwards PUT /schedules/:id', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 200,
        headers: new Headers({ 'content-type': 'text/plain' }),
        text: async () => 'OK',
      });

      const updateData = {
        jobName: 'testJob',
        cronExpression: '0 0 12 * * *',
        parameters: {},
      };

      const response = await request(app)
        .put('/schedules/s2?environment=dev')
        .send(updateData);

      expect(response.status).toBe(200);
      expect(response.text).toBe('OK');
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/batch/schedules/s2',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updateData),
        }),
      );
    });

    it('forwards DELETE /schedules/:id', async () => {
      mockFetch.mockResolvedValueOnce({
        status: 204,
        headers: new Headers(),
        text: async () => '',
      });

      const response = await request(app).delete('/schedules/s2?environment=dev');

      expect(response.status).toBe(204);
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:8080/api/batch/schedules/s2',
        expect.objectContaining({ method: 'DELETE' }),
      );
    });
  });
});
