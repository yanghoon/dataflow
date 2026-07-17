import type { LoggerService } from '@backstage/backend-plugin-api';
import type { Config } from '@backstage/config';
import knex, { type Knex } from 'knex';

export interface DatabaseConfig {
  client: string;
  connection: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    ssl?: any;
  };
  pool?: {
    min?: number;
    max?: number;
    idleTimeoutMillis?: number;
  };
  acquireConnectionTimeout?: number;
}

export class SpringBatchDatabase {
  private knex: Knex;
  private logger: LoggerService;
  private environment: string;

  static async create(
    config: Config,
    logger: LoggerService,
    environment: string,
  ): Promise<SpringBatchDatabase> {
    const dbConfig = SpringBatchDatabase.getEnvironmentConfig(
      config,
      environment,
    );

    const knexInstance = knex({
      client: dbConfig.client,
      connection: dbConfig.connection,
      pool: {
        min: dbConfig.pool?.min ?? 2,
        max: dbConfig.pool?.max ?? 10,
        idleTimeoutMillis: dbConfig.pool?.idleTimeoutMillis ?? 30000,
      },
      acquireConnectionTimeout: dbConfig.acquireConnectionTimeout ?? 60000,
    });

    logger.info(
      `Connecting to Spring Batch database for environment "${environment}" at ${dbConfig.connection.host}:${dbConfig.connection.port}/${dbConfig.connection.database}`,
    );

    const database = new SpringBatchDatabase(knexInstance, logger, environment);

    // Connection health check
    const isHealthy = await database.healthCheck();
    if (!isHealthy) {
      throw new Error(
        `Database health check failed for environment "${environment}" - unable to establish connection`,
      );
    }
    logger.info(
      `Spring Batch database connection established for environment "${environment}"`,
    );

    return database;
  }

  private static getEnvironmentConfig(
    config: Config,
    environment: string,
  ): DatabaseConfig {
    const envConfig = config.getConfig(`springBatch.databases.${environment}`);

    const dbConfig: DatabaseConfig = {
      client: envConfig.getString('client'),
      connection: {
        host: envConfig.getString('connection.host'),
        port: envConfig.getNumber('connection.port'),
        user: envConfig.getString('connection.user'),
        password: envConfig.getString('connection.password'),
        database: envConfig.getString('connection.database'),
      },
      pool: envConfig.has('pool')
        ? {
            min: envConfig.getOptionalNumber('pool.min'),
            max: envConfig.getOptionalNumber('pool.max'),
            idleTimeoutMillis: envConfig.getOptionalNumber(
              'pool.idleTimeoutMillis',
            ),
          }
        : undefined,
      acquireConnectionTimeout: envConfig.getOptionalNumber(
        'acquireConnectionTimeout',
      ),
    };

    // Optional SSL configuration
    if (envConfig.has('connection.ssl')) {
      dbConfig.connection.ssl = envConfig.getOptional('connection.ssl');
    }

    return dbConfig;
  }

  private constructor(knex: Knex, logger: LoggerService, environment: string) {
    this.knex = knex;
    this.logger = logger;
    this.environment = environment;
  }

  getKnex(): Knex {
    return this.knex;
  }

  getEnvironment(): string {
    return this.environment;
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.knex.raw('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error(
        `Database health check failed for environment "${this.environment}": ${error}`,
      );
      return false;
    }
  }

  async close(): Promise<void> {
    await this.knex.destroy();
    this.logger.info(
      `Spring Batch database connection closed for environment "${this.environment}"`,
    );
  }
}
