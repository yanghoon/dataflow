export interface Config {
  springBatch?: {
    /**
     * Default environment to use when not specified in API requests
     * If not set, the first configured database environment will be used as default
     * @visibility backend
     */
    defaultEnvironment?: string;

    /**
     * Database configurations for different environments
     * You can configure as many environments as needed (e.g., production, staging, development)
     * @visibility backend
     */
    databases: {
      [environmentName: string]: {
        /**
         * Database client type (currently only 'pg' for PostgreSQL is supported)
         * @visibility backend
         */
        client: 'pg';

        /**
         * Database connection settings
         * @visibility backend
         */
        connection: {
          /**
           * Database host
           * Supports environment variable substitution (e.g., ${DB_HOST})
           * @example 'localhost' | 'batch-db.example.com' | '${PROD_DB_HOST}'
           * @visibility backend
           */
          host: string;

          /**
           * Database port
           * @example 5432
           * @visibility backend
           */
          port: number;

          /**
           * Database username
           * Supports environment variable substitution (e.g., ${DB_USER})
           * @example 'batch_readonly' | '${PROD_DB_USER}'
           * @visibility backend
           */
          user: string;

          /**
           * Database password
           * IMPORTANT: Use environment variables or Kubernetes secrets for sensitive data
           * Never commit plain-text passwords to version control
           * @example '${PROD_DB_PASSWORD}'
           * @visibility secret
           */
          password: string;

          /**
           * Database name
           * @example 'spring_batch'
           * @visibility backend
           */
          database: string;

          /**
           * SSL configuration (optional)
           * @visibility backend
           */
          ssl?:
            | boolean
            | {
                rejectUnauthorized?: boolean;
                ca?: string;
                key?: string;
                cert?: string;
              };
        };

        /**
         * Connection pool settings (optional)
         * @visibility backend
         */
        pool?: {
          /**
           * Minimum number of connections in the pool
           * @default 2
           * @visibility backend
           */
          min?: number;

          /**
           * Maximum number of connections in the pool
           * @default 10
           * @visibility backend
           */
          max?: number;

          /**
           * Idle timeout in milliseconds
           * @default 30000
           * @visibility backend
           */
          idleTimeoutMillis?: number;
        };

        /**
         * Connection acquisition timeout in milliseconds
         * @default 60000
         * @visibility backend
         */
        acquireConnectionTimeout?: number;

        /**
         * HTTP REST API server configuration for job execution
         * @visibility backend
         */
        http?: {
          /**
           * REST API server URL to trigger job executions
           * @example 'http://batch-api.example.com'
           */
          url: string;

          /**
           * Optional headers to include in upstream requests
           * @visibility backend
           */
          headers?: {
            [key: string]: string;
          };
        };
      };
    };
  };
}
