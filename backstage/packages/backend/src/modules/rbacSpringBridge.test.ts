import { mockServices, startTestBackend } from '@backstage/backend-test-utils';
import rbacSpringBridge from './rbacSpringBridge';
import request from 'supertest';

describe('rbacSpringBridge', () => {
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    fetchSpy = jest.spyOn(global, 'fetch').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('proxies request and forwards status codes correctly', async () => {
    fetchSpy.mockResolvedValue({
      status: 409,
      headers: new Headers(),
      text: async () => 'conflict error',
    } as any);

    const { server } = await startTestBackend({
      features: [
        rbacSpringBridge,
        mockServices.rootConfig.factory({
          data: {
            platform: {
              baseUrl: 'http://backend:8080',
            },
          },
        }),
      ],
    });

    const response = await request(server).get('/api/permission/roles');

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://backend:8080/api/v1/platform/roles',
      expect.objectContaining({ method: 'GET' })
    );
    expect(response.status).toBe(409);
    expect(response.text).toBe('conflict error');
  });

  it('returns 502 on network errors', async () => {
    fetchSpy.mockRejectedValue(new Error('Network error'));

    const { server } = await startTestBackend({
      features: [
        rbacSpringBridge,
        mockServices.rootConfig.factory({
          data: {
            platform: {
              baseUrl: 'http://backend:8080',
            },
          },
        }),
      ],
    });

    const response = await request(server).get('/api/permission/roles');

    expect(fetchSpy).toHaveBeenCalledWith(
      'http://backend:8080/api/v1/platform/roles',
      expect.objectContaining({ method: 'GET' })
    );
    expect(response.status).toBe(502);
    expect(response.body).toEqual({ error: 'Network Error' });
  });
});
