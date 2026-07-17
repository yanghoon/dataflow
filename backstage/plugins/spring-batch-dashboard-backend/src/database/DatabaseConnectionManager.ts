import type { LoggerService } from '@backstage/backend-plugin-api';
import type { Config } from '@backstage/config';
import type { Knex } from 'knex';
import { SpringBatchDatabase } from './SpringBatchDatabase';

export class DatabaseConnectionManager {
  private connections: Map<string, SpringBatchDatabase> = new Map();
  private connectionPromises: Map<string, Promise<SpringBatchDatabase>> =
    new Map();
  private logger: LoggerService;
  private config: Config;
  private availableEnvironments: string[];
  private defaultEnvironment: string;

  constructor(
    config: Config,
    logger: LoggerService,
    availableEnvironments: string[],
    defaultEnvironment: string,
  ) {
    this.config = config;
    this.logger = logger;
    this.availableEnvironments = availableEnvironments;
    this.defaultEnvironment = defaultEnvironment;
  }

  static async create(
    config: Config,
    logger: LoggerService,
  ): Promise<DatabaseConnectionManager> {
    // Read available environments from config
    const databases = config.getConfig('springBatch.databases');
    const availableEnvironments = databases.keys();

    if (availableEnvironments.length === 0) {
      throw new Error(
        'No database environments configured. Please configure at least one database under springBatch.databases',
      );
    }

    // Use the first environment as default, or allow override
    const defaultEnvironment =
      config.getOptionalString('springBatch.defaultEnvironment') ||
      availableEnvironments[0];

    if (!availableEnvironments.includes(defaultEnvironment)) {
      throw new Error(
        `Default environment "${defaultEnvironment}" not found in configured databases: ${availableEnvironments.join(', ')}`,
      );
    }

    const manager = new DatabaseConnectionManager(
      config,
      logger,
      availableEnvironments,
      defaultEnvironment,
    );

    logger.info(
      `DatabaseConnectionManager created with environments: ${availableEnvironments.join(', ')} (default: ${defaultEnvironment})`,
    );
    logger.info('Database connections will be initialized lazily on first use');

    return manager;
  }

  getAvailableEnvironments(): string[] {
    return [...this.availableEnvironments];
  }

  getDefaultEnvironment(): string {
    return this.defaultEnvironment;
  }

  async getConnection(environment?: string): Promise<Knex> {
    const env = environment || this.defaultEnvironment;

    // Validate environment
    if (!this.availableEnvironments.includes(env)) {
      throw new Error(
        `Invalid environment "${env}". Available environments: ${this.availableEnvironments.join(', ')}`,
      );
    }

    // Return existing connection if available
    const existingConnection = this.connections.get(env);
    if (existingConnection) {
      return existingConnection.getKnex();
    }

    // Check if connection is already being established
    const existingPromise = this.connectionPromises.get(env);
    if (existingPromise) {
      this.logger.debug(
        `Waiting for existing connection promise for "${env}"`,
      );
      const database = await existingPromise;
      return database.getKnex();
    }

    // Create new connection
    this.logger.info(
      `Establishing database connection for environment: "${env}"`,
    );
    const connectionPromise = SpringBatchDatabase.create(
      this.config,
      this.logger,
      env,
    );

    this.connectionPromises.set(env, connectionPromise);

    try {
      const database = await connectionPromise;
      this.connections.set(env, database);
      this.connectionPromises.delete(env);
      this.logger.info(
        `Database connection established for environment: "${env}"`,
      );
      return database.getKnex();
    } catch (error: any) {
      this.connectionPromises.delete(env);
      this.logger.error(
        `Failed to connect to "${env}" environment: ${error.message}`,
      );
      throw new Error(
        `Failed to establish database connection for "${env}": ${error.message}`,
      );
    }
  }

  async closeAll(): Promise<void> {
    for (const [env, database] of this.connections.entries()) {
      try {
        await database.close();
        this.logger.info(`Closed database connection for environment: "${env}"`);
      } catch (error: any) {
        this.logger.error(
          `Failed to close connection for "${env}": ${error.message}`,
        );
      }
    }
    this.connections.clear();
  }
}
