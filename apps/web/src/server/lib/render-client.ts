import { ClientError, Render, ServerError } from "@renderinc/sdk";

/** Missing credentials are a deploy misconfiguration, not a transient failure. */
export class WorkflowConfigError extends Error {
  override readonly name = "WorkflowConfigError";
}

export function getRenderClient(): Render {
  const baseUrl = process.env.RENDER_API_URL;
  const token = process.env.RENDER_API_KEY;
  if (!token) {
    throw new WorkflowConfigError(
      "RENDER_API_KEY is not set. Add a Render API key to the web service to trigger workflows."
    );
  }
  return new Render({ baseUrl, token });
}

export type WorkflowStartFailure = {
  /** Stable code so the client never string-matches messages. */
  code: "workflow_auth" | "workflow_not_found" | "workflow_unavailable";
  /** Safe to persist and show: names the env var to fix, never the token. */
  message: string;
  /** Present when Render answered; absent for network-level failures. */
  statusCode?: number;
  /** Server-log only. May echo the Render API response body. */
  detail: string;
};

/**
 * Maps a failed `workflows.startTask` into an operator-actionable failure.
 * A 401/403 means the API key is bad; a 404 means the task slug does not
 * resolve. Both look identical in the SDK, so classify before reporting.
 */
export function classifyWorkflowStartError(
  error: unknown,
  workflowSlug: string
): WorkflowStartFailure {
  const detail = error instanceof Error ? error.message : String(error);

  if (error instanceof WorkflowConfigError) {
    return { code: "workflow_auth", message: error.message, detail };
  }

  if (error instanceof ClientError) {
    const statusCode = error.statusCode;
    if (statusCode === 401 || statusCode === 403) {
      return {
        code: "workflow_auth",
        message:
          "Render rejected the workflow trigger. RENDER_API_KEY on this service is invalid, expired, or belongs to another workspace.",
        statusCode,
        detail,
      };
    }
    if (statusCode === 404) {
      return {
        code: "workflow_not_found",
        message: `Render has no task "${workflowSlug}/run_bakeoff". Check WORKFLOW_SLUG and that the workflow has deployed.`,
        statusCode,
        detail,
      };
    }
    return {
      code: "workflow_unavailable",
      message: `Render rejected the workflow trigger (HTTP ${statusCode}).`,
      statusCode,
      detail,
    };
  }

  if (error instanceof ServerError) {
    return {
      code: "workflow_unavailable",
      message: `Render could not start the workflow (HTTP ${error.statusCode}). Retry shortly.`,
      statusCode: error.statusCode,
      detail,
    };
  }

  return {
    code: "workflow_unavailable",
    message: "Could not reach Render to start the workflow. Retry shortly.",
    detail,
  };
}
