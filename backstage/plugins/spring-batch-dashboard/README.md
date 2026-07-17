# Spring Batch Frontend Plugin for Backstage

Frontend plugin for monitoring Spring Batch job executions in Backstage. Provides a comprehensive dashboard UI for viewing job statistics, execution history, and failure analysis.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue)](https://www.typescriptlang.org/)
[![Backstage](https://img.shields.io/badge/Backstage-1.x-brightgreen)](https://backstage.io/)
[![React](https://img.shields.io/badge/React-18.x-61DAFB)](https://reactjs.org/)
[![Material-UI](https://img.shields.io/badge/Material--UI-6.x-0081CB)](https://mui.com/)
[![License](https://img.shields.io/badge/License-Apache%202.0-orange)](LICENSE)

## Features

- **📊 Dashboard Overview**: Real-time statistics and recent execution history
- **🔍 Advanced Filtering**: Filter by status, job name, date range, and Boot version
- **📈 Analytics & Trends**: Visualize execution patterns over time
- **❌ Failure Analysis**: Dedicated view for failed jobs with error details
- **🔄 Retry History**: Track job instance retry attempts and outcomes
- **🌍 Multi-Environment Support**: Switch between different environments (dev, staging, production)
- **🎨 Modern UI**: Material-UI components with responsive design

## Prerequisites

This frontend plugin requires the backend plugin to be installed and configured:

- **`@jikwan/backstage-plugin-spring-batch-dashboard-backend`** - REST API for Spring Batch metadata
  - See [backend plugin README](../spring-batch-backend/README.md) for setup instructions

## Installation

```bash
cd packages/app
yarn add @jikwan/backstage-plugin-spring-batch-dashboard
```

## Setup

### 1. Add Plugin Routes

Edit `packages/app/src/App.tsx`:

```typescript
import {
  SpringBatchPage,
  SpringBatchExecutionDetail,
  SpringBatchFailuresPage,
  SpringBatchRetryHistoryPage,
  SpringBatchJobInstancesPage,
  SpringBatchJobExecutionsPage,
  SpringBatchStepDetail,
} from '@jikwan/backstage-plugin-spring-batch-dashboard';

// Inside your <FlatRoutes> component:
<Route path="/spring-batch-dashboard" element={<SpringBatchPage />} />
<Route path="/spring-batch-dashboard/instances" element={<JobInstancesPage />} />
<Route path="/spring-batch-dashboard/executions" element={<JobExecutionsPage />} />
<Route path="/spring-batch-dashboard/failures" element={<FailuresPage />} />
<Route
  path="/spring-batch-dashboard/instances/:instanceId/history"
  element={<RetryHistoryPage />}
/>
<Route path="/spring-batch-dashboard/executions/:id" element={<ExecutionDetail />} />
<Route path="/spring-batch-dashboard/steps/:stepId" element={<StepDetail />} />
```

### 2. Add Sidebar Navigation

Edit `packages/app/src/components/Root/Root.tsx`:

```typescript
import DashboardIcon from '@mui/icons-material/Dashboard';
import StorageIcon from '@mui/icons-material/Storage';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import ErrorIcon from '@mui/icons-material/Error';

// Inside your sidebar:
<SidebarItem icon={DashboardIcon} to="spring-batch-dashboard" text="Spring Batch Dashboard">
  <SidebarSubmenu title="Spring Batch Dashboard">
    <SidebarSubmenuItem
      title="Dashboard"
      to="spring-batch-dashboard"
      icon={DashboardIcon}
    />
    <SidebarSubmenuItem
      title="Job Instances"
      to="spring-batch-dashboard/instances"
      icon={StorageIcon}
    />
    <SidebarSubmenuItem
      title="Job Executions"
      to="spring-batch-dashboard/executions"
      icon={PlaylistPlayIcon}
    />
    <SidebarSubmenuItem
      title="Failures"
      to="spring-batch-dashboard/failures"
      icon={ErrorIcon}
    />
  </SidebarSubmenu>
</SidebarItem>
```

### 3. Start Backstage

```bash
yarn dev
```

Navigate to `http://localhost:3000/spring-batch-dashboard` to see the dashboard.

## Available Pages

### Dashboard (`/spring-batch-dashboard`)

Main overview page with:
- Real-time job statistics (total, running, completed, failed)
- Status breakdown chart
- Recent executions table
- Quick filters by date range

### Job Instances (`/spring-batch-dashboard/instances`)

List of all job instances with:
- Execution counts
- Last execution status and time
- Boot version (Boot3 or Boot4)
- Click to view retry history

### Job Executions (`/spring-batch-dashboard/executions`)

Detailed execution list with:
- Advanced filtering (status, job name, date range, Boot version)
- Pagination support
- Execution duration
- Click to view execution details

### Failures (`/spring-batch-dashboard/failures`)

Failed job executions with:
- Error messages and exit codes
- Step-level failure details
- Retry history access
- Quick troubleshooting

### Execution Detail (`/spring-batch-dashboard/executions/:id`)

Detailed view of a single execution:
- Job parameters
- Step execution breakdown
- Timing information
- Read/write/skip counts
- Error messages

### Step Detail (`/spring-batch-dashboard/steps/:stepId`)

Individual step execution details:
- Step-level metrics
- Commit/rollback counts
- Skip counts (read/write/process)
- Exit codes and messages

### Retry History (`/spring-batch-dashboard/instances/:instanceId/history`)

Track job instance retry attempts:
- All executions for a job instance
- Chronological order
- Status progression
- Identify patterns in failures

## Features in Detail

### Environment Switching

Switch between different environments (dev, staging, production) using the environment selector at the top of each page. Available environments are dynamically loaded from the backend configuration.

```typescript
// The plugin automatically fetches available environments from:
// GET /api/spring-batch-dashboard/environments
```

### Boot Version Filtering

Filter executions by Spring Boot version (Boot 3 or Boot 4) to separate different application versions:

- **Boot 3**: Spring Boot 2.x / Spring Batch 5.x
- **Boot 4**: Spring Boot 3.x / Spring Batch 6.x

### Date Range Selection

Use the date range picker for flexible time-based filtering:
- Quick select buttons (Last 7 days, Last 30 days, etc.)
- Custom date range picker
- Auto-refresh on date change

## Component Customization

### Custom Environment Labels

Override default environment labels by modifying the `getEnvironmentLabel` function:

```typescript
// In your app/src/components/springBatch/customLabels.ts
export function getEnvironmentLabel(environment: string): string {
  const labelMap: Record<string, string> = {
    dev: 'Development',
    qa: 'Quality Assurance',
    'prd-virginia': 'Production (US-East)',
    'prd-seoul': 'Production (Asia)',
  };
  return labelMap[environment] || environment.toUpperCase();
}
```

### Theming

The plugin uses Material-UI theming and respects your Backstage theme configuration. Customize colors in `packages/app/src/theme`:

```typescript
// Example: Custom status colors
const theme = createTheme({
  palette: {
    success: { main: '#4caf50' },
    error: { main: '#f44336' },
    warning: { main: '#ff9800' },
  },
});
```

## API Integration

The frontend plugin communicates with the backend via the `SpringBatchClient`:

```typescript
import { useApi } from '@backstage/core-plugin-api';
import { springBatchApiRef } from '@jikwan/backstage-plugin-spring-batch-dashboard';

function MyComponent() {
  const api = useApi(springBatchApiRef);

  // Fetch statistics
  const stats = await api.getStatistics('production');

  // Fetch executions with filters
  const executions = await api.getExecutions({
    status: 'FAILED',
    limit: 50,
    offset: 0,
  }, 'production', 'Boot3');

  // Get execution details
  const execution = await api.getExecutionDetail(123, 'production', 'Boot3');
}
```

### Available API Methods

See the `SpringBatchClient` class for all available methods:

```typescript
class SpringBatchClient {
  getEnvironments(): Promise<{ environments: string[]; defaultEnvironment: string; }>
  getStatistics(environment?: Environment): Promise<JobStatistics>
  getExecutions(query?: JobExecutionQuery, environment?: Environment, bootVersion?: 'Boot3' | 'Boot4'): Promise<JobExecution[]>
  getExecutionDetail(id: number, environment?: Environment, bootVersion?: 'Boot3' | 'Boot4'): Promise<JobExecution>
  getStepDetail(id: number, environment?: Environment, bootVersion?: 'Boot3' | 'Boot4'): Promise<StepExecution>
  getJobs(environment?: Environment): Promise<JobInstance[]>
  getJobInstancesWithStats(environment?: Environment): Promise<JobInstanceWithStats[]>
  getJobExecutions(name: string, limit?: number): Promise<JobExecution[]>
  getJobExecutionsWithSteps(name: string, limit?: number): Promise<JobExecution[]>
  getDailyStatistics(date: string, environment?: Environment): Promise<DailyStatistics>
  getDailyJobSummaries(date: string, environment?: Environment): Promise<DailyJobSummary[]>
  getTrendData(fromDate: string, toDate: string, environment?: Environment): Promise<DailyTrendData[]>
  getJobInstanceExecutions(jobInstanceId: number, environment?: Environment, bootVersion?: 'Boot3' | 'Boot4'): Promise<JobExecution[]>
}
```

## Development

### Running Locally

```bash
# Install dependencies
yarn install

# Build the plugin
yarn workspace @jikwan/backstage-plugin-spring-batch-dashboard build

# Start Backstage in dev mode
yarn dev
```

### Testing

```bash
# Run tests
yarn workspace @jikwan/backstage-plugin-spring-batch-dashboard test

# Run tests in watch mode
yarn workspace @jikwan/backstage-plugin-spring-batch-dashboard test --watch

# Run linter
yarn workspace @jikwan/backstage-plugin-spring-batch-dashboard lint
```

### Building

```bash
# Build for production
yarn workspace @jikwan/backstage-plugin-spring-batch-dashboard build

# Clean build artifacts
yarn workspace @jikwan/backstage-plugin-spring-batch-dashboard clean
```

## Troubleshooting

### No Data Displayed

**Issue**: Dashboard shows no data or empty tables

**Solutions**:
1. Verify backend plugin is installed and running
2. Check browser console for API errors
3. Verify backend API is accessible:
   ```bash
   curl http://localhost:7007/api/spring-batch-dashboard/environments
   ```
4. Check backend configuration in `app-config.yaml`
5. Ensure database contains Spring Batch metadata

### Environment Not Available

**Issue**: Environment selector shows only default environment

**Solutions**:
1. Check backend `app-config.yaml` has multiple environments configured
2. Verify backend API returns all environments:
   ```bash
   curl http://localhost:7007/api/spring-batch-dashboard/environments
   ```
3. Restart Backstage after config changes

### Routing Issues

**Issue**: Navigation doesn't work or shows 404

**Solutions**:
1. Verify all routes are added to `App.tsx`
2. Check route paths match exactly (case-sensitive)
3. Ensure `react-router-dom` is installed
4. Clear browser cache and hard reload

### Performance Issues

**Issue**: Slow page loads or laggy UI

**Solutions**:
1. Reduce page size limit (default is 50)
2. Add database indexes on backend (see backend README)
3. Use date range filters to limit data
4. Consider backend connection pooling configuration

## Architecture

```
┌─────────────────────────────────────┐
│     Backstage Frontend (React)      │
├─────────────────────────────────────┤
│   Spring Batch Plugin (This)        │
│   - Dashboard UI                    │
│   - Execution List                  │
│   - Failure Analysis                │
│   - Retry History                   │
│   - SpringBatchClient (API)         │
└──────────────┬──────────────────────┘
               │ REST API
               ▼
┌─────────────────────────────────────┐
│   Spring Batch Backend Plugin       │
│   - REST Endpoints                  │
│   - Database Queries                │
│   - Multi-Environment Support       │
└──────────────┬──────────────────────┘
               │ SQL Queries
               ▼
┌─────────────────────────────────────┐
│      PostgreSQL Metadata DB         │
│   (Spring Batch Schema Tables)      │
└─────────────────────────────────────┘
```

## Related Packages

This is the frontend plugin. For the complete monitoring solution, also install:

- **`@jikwan/backstage-plugin-spring-batch-dashboard-backend`** (Backend) - [README](../spring-batch-backend/README.md)
  - REST API endpoints
  - Database connections
  - Multi-environment support
  - Analytics queries

## Technology Stack

- **Frontend Framework**: React 18.x
- **UI Library**: Material-UI (MUI) 6.x
- **Routing**: React Router v6
- **State Management**: React Hooks (useState, useEffect, useMemo)
- **Backstage**: 1.x Plugin API
- **TypeScript**: 5.x

## Contributing

Contributions are welcome! Please follow the standard Backstage plugin development guidelines.

## License

Apache-2.0

## Support

For issues and questions:
- GitHub Issues: [backstage-plugins/spring-batch](https://github.com/your-org/backstage-plugins)
- Documentation: See `/docs` folder for detailed guides
