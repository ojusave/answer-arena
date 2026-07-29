import { ClientError, Render, ServerError } from "@renderinc/sdk";
import {
  WorkflowDispatchError,
  type WorkflowDispatcher,
} from "@ragtime/core";

function renderDispatchError(error: unknown, taskSlug: string): WorkflowDispatchError {
  const detail = error instanceof Error ? error.message : String(error);
  if (error instanceof ClientError) {
    const statusCode = error.statusCode;
    if (statusCode === 401 || statusCode === 403) {
      return new WorkflowDispatchError(
        "workflow_auth",
        "The workflow dispatcher rejected its credentials.",
        detail,
        statusCode
      );
    }
    if (statusCode === 404) {
      return new WorkflowDispatchError(
        "workflow_not_found",
        `The workflow task "${taskSlug}" is not available.`,
        detail,
        statusCode
      );
    }
    return new WorkflowDispatchError(
      "workflow_unavailable",
      `The workflow dispatcher rejected the request (HTTP ${statusCode}).`,
      detail,
      statusCode
    );
  }
  if (error instanceof ServerError) {
    return new WorkflowDispatchError(
      "workflow_unavailable",
      `The workflow dispatcher could not start the task (HTTP ${error.statusCode}).`,
      detail,
      error.statusCode
    );
  }
  return new WorkflowDispatchError(
    "workflow_unavailable",
    "The workflow dispatcher could not be reached.",
    detail
  );
}

function createRenderWorkflowDispatcher(workflowSlug: string): WorkflowDispatcher {
  return {
    async dispatch(taskName, args) {
      const token = process.env.RENDER_API_KEY;
      if (!token) {
        throw new WorkflowDispatchError(
          "workflow_auth",
          "The workflow dispatcher is not configured.",
          "RENDER_API_KEY is not set"
        );
      }
      const render = new Render({
        baseUrl: process.env.RENDER_API_URL,
        token,
      });
      const taskSlug = `${workflowSlug}/${taskName}`;
      try {
        await render.workflows.startTask(taskSlug, [...args]);
      } catch (error) {
        throw renderDispatchError(error, taskSlug);
      }
    },
  };
}

/** Selects the workflow trigger adapter without exposing its SDK to routes. */
export function createWorkflowDispatcher(
  workflowSlug: string,
  provider = process.env.WORKFLOW_DISPATCHER ?? "render"
): WorkflowDispatcher {
  switch (provider) {
    case "render":
      return createRenderWorkflowDispatcher(workflowSlug);
    default:
      throw new Error(`Unknown WORKFLOW_DISPATCHER "${provider}"`);
  }
}
