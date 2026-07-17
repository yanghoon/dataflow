# Spring Batch Backend Plugin for Backstage

Backend plugin for monitoring Spring Batch job executions in Backstage. Provides REST API endpoints for querying Spring Batch metadata databases with support for multiple environments.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Backstage](https://img.shields.io/badge/Backstage-1.x-brightgreen)](https://backstage.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-12+-336791)](https://www.postgresql.org/)
[![License](https://img.shields.io/badge/License-Apache%202.0-orange)](LICENSE)

> **Note**: This is the backend plugin. For the complete monitoring solution with dashboard UI, also install the [frontend plugin](../spring-batch/README.md).

## Features

- **Multi-Environment Support**: Monitor batch jobs across different environments (production, staging, development, etc.)
- **Centralized Monitoring**: Query Spring Batch metadata from a single API
- **Performance Analytics**: Analyze step-level bottlenecks and track execution trends
- **Read-Only Access**: Safe monitoring without affecting job execution
- **Flexible Configuration**: Environment-based database connections with support for Kubernetes secrets
- **RESTful API**: Well-documented endpoints with input validation and error handling

## Installation

```bash
cd packages/backend
yarn add @jikwan/backstage-plugin-spring-batch-dashboard-backend
```

## Configuration

Add the plugin configuration to your `app-config.yaml`:

```yaml
springBatch:
  # Optional: specify default environment (defaults to first configured database)
  defaultEnvironment: production

  # Configure database connections for each environment
  databases:
    production:
      client: pg
      connection:
        host: ${SPRING_BATCH_PROD_HOST}
        port: 5432
        user: ${SPRING_BATCH_PROD_USER}
        password: ${SPRING_BATCH_PROD_PASSWORD}
        database: spring_batch
        ssl:
          rejectUnauthorized: false
      pool:
        min: 5
        max: 20
        idleTimeoutMillis: 30000
      acquireConnectionTimeout: 60000

    staging:
      client: pg
      connection:
        host: ${SPRING_BATCH_STAGING_HOST}
        port: 5432
        user: ${SPRING_BATCH_STAGING_USER}
        password: ${SPRING_BATCH_STAGING_PASSWORD}
        database: spring_batch
      pool:
        min: 2
        max: 10

    development:
      client: pg
      connection:
        host: localhost
        port: 5432
        user: postgres
        password: ${POSTGRES_PASSWORD}
        database: spring_batch
```

### Environment Variables

Set environment variables for database credentials:

```bash
# Production
export SPRING_BATCH_PROD_HOST=batch-db.example.com
export SPRING_BATCH_PROD_USER=batch_readonly
export SPRING_BATCH_PROD_PASSWORD=your_secure_password

# Staging
export SPRING_BATCH_STAGING_HOST=batch-db-staging.example.com
export SPRING_BATCH_STAGING_USER=batch_readonly
export SPRING_BATCH_STAGING_PASSWORD=your_secure_password

# Development
export POSTGRES_PASSWORD=postgres
```

### Kubernetes Secrets

For Kubernetes deployments, inject secrets as environment variables:

```yaml
# kubernetes/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backstage
spec:
  template:
    spec:
      containers:
        - name: backstage
          env:
            - name: SPRING_BATCH_PROD_HOST
              valueFrom:
                secretKeyRef:
                  name: spring-batch-db
                  key: host
            - name: SPRING_BATCH_PROD_USER
              valueFrom:
                secretKeyRef:
                  name: spring-batch-db
                  key: username
            - name: SPRING_BATCH_PROD_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: spring-batch-db
                  key: password
```

## Backend Setup

Register the plugin in your `packages/backend/src/index.ts`:

```typescript
// packages/backend/src/index.ts
const backend = createBackend();

// ... other plugins

backend.add(import('@jikwan/backstage-plugin-spring-batch-dashboard-backend'));

backend.start();
```

## Database Schema

This plugin requires a PostgreSQL database with Spring Batch metadata tables. The standard Spring Batch schema includes:

- `batch_job_instance` - Job definitions
- `batch_job_execution` - Job execution records
- `batch_job_execution_params` - Job parameters
- `batch_step_execution` - Step execution details
- `batch_step_execution_context` - Step context
- `batch_job_execution_context` - Job context

### Schema Initialization

For Spring Boot 2.x (Boot 3 tables):
```sql
-- Run the Spring Batch schema initialization script
-- Available at: org/springframework/batch/core/schema-postgresql.sql
```

For Spring Boot 3.x+ (Boot 4 tables):
```sql
-- The schema is the same, just ensure your Spring Boot app has initialized it
```

### Recommended Indexes

For optimal query performance, create these indexes:

```sql
-- Core indexes
CREATE INDEX idx_job_exec_status ON batch_job_execution(status);
CREATE INDEX idx_job_exec_start_time ON batch_job_execution(start_time DESC);
CREATE INDEX idx_job_name ON batch_job_instance(job_name);
CREATE INDEX idx_job_instance_id ON batch_job_execution(job_instance_id);
CREATE INDEX idx_step_exec_job_id ON batch_step_execution(job_execution_id);

-- Analytics indexes
CREATE INDEX idx_job_exec_start_time_status ON batch_job_execution(start_time DESC, status);
CREATE INDEX idx_job_exec_completed_times ON batch_job_execution(status, start_time, end_time)
  WHERE status = 'COMPLETED' AND start_time IS NOT NULL AND end_time IS NOT NULL;
```

### Read-Only User (Recommended)

Create a dedicated read-only user for security:

```sql
-- Create read-only user
CREATE USER batch_readonly WITH PASSWORD 'secure_password';

-- Grant schema access
GRANT USAGE ON SCHEMA public TO batch_readonly;

-- Grant read permissions
GRANT SELECT ON ALL TABLES IN SCHEMA public TO batch_readonly;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO batch_readonly;

-- Grant permissions for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT ON TABLES TO batch_readonly;
```

## API Endpoints

All endpoints support an optional `environment` query parameter to specify which database to query.

### GET /api/spring-batch-dashboard/statistics

Get overall batch job statistics.

**Query Parameters:**
- `environment` (string, optional): Target environment (default: configured default)

**Example:**
```bash
curl "http://localhost:7007/api/spring-batch-dashboard/statistics?environment=production"
```

**Response:**
```json
{
  "totalJobs": 50,
  "runningJobs": 3,
  "completedJobs": 42,
  "failedJobs": 5,
  "statusBreakdown": {
    "COMPLETED": 42,
    "FAILED": 5,
    "STARTED": 3
  },
  "recentExecutions": [...]
}
```

### GET /api/spring-batch-dashboard/executions

List job executions with filtering and pagination.

**Query Parameters:**
- `environment` (string): Target environment
- `limit` (number): Max results (default: 50, max: 1000)
- `offset` (number): Pagination offset (default: 0)
- `status` (string): Filter by status (COMPLETED, FAILED, STARTED, etc.)
- `jobName` (string): Filter by job name
- `from` (string): Start date (YYYY-MM-DD)
- `to` (string): End date (YYYY-MM-DD)

**Example:**
```bash
curl "http://localhost:7007/api/spring-batch-dashboard/executions?environment=production&status=FAILED&limit=20"
```

### GET /api/spring-batch-dashboard/executions/:id

Get detailed execution information including steps and parameters.

**Example:**
```bash
curl "http://localhost:7007/api/spring-batch-dashboard/executions/123?environment=production"
```

### GET /api/spring-batch-dashboard/jobs/:name/executions

Get execution history for a specific job.

**Query Parameters:**
- `environment` (string): Target environment
- `limit` (number): Max results (default: 20)
- `includeSteps` (boolean): Include step details

**Example:**
```bash
curl "http://localhost:7007/api/spring-batch-dashboard/jobs/userSyncJob/executions?environment=production&includeSteps=true"
```

### Additional Endpoints

- `GET /api/spring-batch-dashboard/jobs` - List all job names
- `GET /api/spring-batch-dashboard/steps/:id` - Get step execution details
- `GET /api/spring-batch-dashboard/daily/:date/statistics` - Daily statistics
- `GET /api/spring-batch-dashboard/daily/:date/jobs` - Daily job summaries
- `GET /api/spring-batch-dashboard/analytics/trend` - Trend data for date range
- `GET /api/spring-batch-dashboard/instances/:id/executions` - Job instance retry history

See the [API documentation](./docs/api.md) for complete endpoint details.

## Local Development

### Prerequisites

- Docker and Docker Compose (recommended) OR PostgreSQL 12+
- Node.js 18+
- Yarn

### Quick Start

1. **Start PostgreSQL:**

```bash
# Using Docker Compose
docker-compose up -d

# OR using local PostgreSQL
psql -U postgres -c "CREATE DATABASE spring_batch;"
```

2. **Initialize Database Schema:**

The plugin includes a schema file with Boot3 and Boot4 table prefixes:

```bash
# Initialize schema (includes boot3_* and boot4_* tables)
psql -U postgres -d spring_batch -f plugins/spring-batch-backend/database/schema.sql

# Optional: Load sample data for testing
psql -U postgres -d spring_batch -f plugins/spring-batch-backend/database/sample-data.sql
```

**Note:** The schema includes both `boot3_*` and `boot4_*` prefixed tables. The plugin will automatically detect and query the available tables.

3. **Configure local environment:**

Create or update `app-config.local.yaml`:

```yaml
springBatch:
  defaultEnvironment: dev
  databases:
    dev:
      client: pg
      connection:
        host: localhost
        port: 5432
        user: ${POSTGRES_USER}
        password: ${POSTGRES_PASSWORD}
        database: spring_batch
```

4. **Set environment variables:**

Create `.env` file:

```bash
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
```

5. **Build and start:**

```bash
# Install dependencies
yarn install

# Build the plugin
yarn workspace @jikwan/backstage-plugin-spring-batch-dashboard-backend build

# Start Backstage
yarn dev
```

6. **Test the API:**

```bash
# Get available environments
curl "http://localhost:7007/api/spring-batch-dashboard/environments"

# Get statistics
curl "http://localhost:7007/api/spring-batch-dashboard/statistics?environment=dev"

# Get executions
curl "http://localhost:7007/api/spring-batch-dashboard/executions?environment=dev&limit=10"
```

## Architecture

```
┌─────────────────────────────────────┐
│     Spring Batch Applications       │
│  (Multiple services/environments)   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│      PostgreSQL Metadata DB         │
│   (Spring Batch Schema Tables)      │
└──────────────┬──────────────────────┘
               │ Read-Only
               ▼
┌─────────────────────────────────────┐
│   Backstage Spring Batch Plugin     │
├─────────────────────────────────────┤
│  Backend (This Package)             │
│  - REST API                         │
│  - Multi-Environment Support        │
│  - Connection Pooling (Knex.js)     │
│  - Analytics & Metrics              │
└─────────────────────────────────────┘
```

## Performance Considerations

### Connection Pooling

Configure pool sizes based on your load:

```yaml
springBatch:
  databases:
    production:
      pool:
        min: 5          # Minimum connections
        max: 20         # Maximum connections
        idleTimeoutMillis: 30000
      acquireConnectionTimeout: 60000
```

### Lazy Connection Initialization

Connections are created only when first accessed, reducing startup time and resource usage for unused environments.

### Query Optimization

- Uses database-level LIMIT/OFFSET for pagination
- Index-friendly date filtering with timestamp ranges
- Partial indexes for specific query patterns

## Security

- **Authentication**: All endpoints require Backstage user authentication
- **Read-Only Access**: Uses SELECT-only database users
- **Input Validation**: Comprehensive parameter validation with sanitized error messages
- **Credential Management**: Supports environment variables and Kubernetes secrets
- **SSL Support**: Optional SSL/TLS for database connections

## Troubleshooting

### Database Connection Errors

**Issue**: `Failed to establish database connection`

**Solutions**:
1. Verify environment variables are set correctly
2. Check database host is accessible from Backstage
3. Ensure database user has SELECT permissions
4. Test connection manually:
   ```bash
   psql -h $SPRING_BATCH_PROD_HOST -U $SPRING_BATCH_PROD_USER -d spring_batch
   ```

### Empty Results

**Issue**: API returns empty arrays

**Solutions**:
1. Verify Spring Batch tables exist and contain data
2. Check table names are lowercase (PostgreSQL converts unquoted identifiers)
3. Ensure read-only user has proper permissions

### Environment Not Found

**Issue**: `Invalid environment "xyz". Available environments: ...`

**Solutions**:
1. Check `app-config.yaml` has the environment configured
2. Verify environment name matches exactly (case-sensitive)
3. Restart Backstage after configuration changes

## Related Packages

This is the backend plugin. For the complete monitoring solution, also install:

- **`@jikwan/backstage-plugin-spring-batch-dashboard`** (Frontend) - [README](../spring-batch/README.md)
  - Dashboard UI with Material-UI
  - Multi-environment switcher
  - Analytics visualizations
  - Job execution and failure analysis
  - Retry history tracking

## Technology Stack

- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL 12+ with Knex.js query builder
- **Backstage**: 1.x Plugin API
- **Connection Pooling**: Knex.js with configurable pool settings

## Contributing

Contributions are welcome! Please follow the standard Backstage plugin development guidelines.

## License

Apache-2.0

## Support

For issues and questions:
- GitHub Issues: [backstage-plugins/spring-batch](https://github.com/your-org/backstage-plugins)
- Documentation: See `/docs` folder for detailed guides
