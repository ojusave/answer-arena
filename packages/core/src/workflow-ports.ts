export type WorkflowTaskArgs = readonly unknown[];

/** Starts durable work without exposing an orchestration vendor to routes. */
export interface WorkflowDispatcher {
  dispatch(taskName: string, args: WorkflowTaskArgs): Promise<void>;
}

export type WorkflowCompute = "small" | "standard" | "large";

export type WorkflowTaskOptions = {
  name: string;
  compute: WorkflowCompute;
  timeoutSeconds: number;
  retry: {
    maxRetries: number;
    waitDurationMs: number;
    backoffScaling: number;
  };
};

export type WorkflowTask<TArgs extends unknown[], TResult> = (
  ...args: TArgs
) => Promise<TResult>;

/** Registers durable task functions while keeping SDK types at the adapter edge. */
export interface WorkflowRuntime {
  defineTask<TArgs extends unknown[], TResult>(
    options: WorkflowTaskOptions,
    implementation: WorkflowTask<TArgs, TResult>
  ): WorkflowTask<TArgs, TResult>;
}
