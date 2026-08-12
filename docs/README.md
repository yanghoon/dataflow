# Design

## Concepts

- Workflow (How)
  - A java class that implements a single ingestion process
- WorkflowJob (Where/When)
  - A configuration of each ingestion batch. (contains source, target, ...)
  - The type of WorkflowJob choose which Workflow to run
- Scheduler
  - External components trigger WorkflowJobs
