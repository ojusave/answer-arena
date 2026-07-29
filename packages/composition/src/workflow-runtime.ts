import { task } from "@renderinc/sdk/workflows";
import type {
  WorkflowRuntime,
  WorkflowTask,
  WorkflowTaskOptions,
} from "@ragtime/core";

const renderPlan = {
  large: "pro",
  small: "starter",
  standard: "standard",
} as const;

function createRenderWorkflowRuntime(): WorkflowRuntime {
  return {
    defineTask(options, implementation) {
      return task(
        {
          name: options.name,
          plan: renderPlan[options.compute],
          timeoutSeconds: options.timeoutSeconds,
          retry: options.retry,
        },
        implementation
      ) as unknown as typeof implementation;
    },
  };
}

/** Selects task registration at the composition boundary. */
export function createWorkflowRuntime(
  provider = process.env.WORKFLOW_RUNTIME ?? "render"
): WorkflowRuntime {
  switch (provider) {
    case "render":
      return createRenderWorkflowRuntime();
    default:
      throw new Error(`Unknown WORKFLOW_RUNTIME "${provider}"`);
  }
}

/** Vendor-neutral task definition used by workflow implementation modules. */
export function defineWorkflowTask<TArgs extends unknown[], TResult>(
  options: WorkflowTaskOptions,
  implementation: WorkflowTask<TArgs, TResult>
): WorkflowTask<TArgs, TResult> {
  return createWorkflowRuntime().defineTask(options, implementation);
}
