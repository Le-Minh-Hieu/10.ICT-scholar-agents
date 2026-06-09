import { log } from "./logger.js";

export type AgentResultStatus = "SUCCESS" | "FAIL" | "NO_DATA";

export interface AgentRunResult<T> {
  status: AgentResultStatus;
  data: T | null;
  _meta: {
    agentName: string;
    durationMs: number;
    timestamp: string;
    error?: string;
  };
}

/**
 * A safe wrapper for executing agent functions.
 * Ensures consistent output schema, error handling, and logging.
 * @param agentName The name of the agent being run.
 * @param agentFn The agent function to execute.
 * @returns A standardized AgentRunResult object.
 */
export async function runSafeAgent<T>(
  agentName: string,
  agentFn: () => Promise<T | null | undefined>
): Promise<AgentRunResult<T>> {
  const startTime = Date.now();
  let data: T | null = null;
  let status: AgentResultStatus = "SUCCESS";
  let error: string | undefined;

  log({ stage: "AGENT_START", message: agentName });

  try {
    const result = await agentFn();
    if (result === undefined || result === null) {
      status = "NO_DATA";
    } else {
      data = result;
    }
  } catch (e: any) {
    status = "FAIL";
    error = e.message || "Unknown error";
    log({
      stage: "AGENT_ERROR",
      message: agentName,
      level: "ERROR",
      data: {
        error,
        stack: e.stack ? e.stack.split('\n').slice(0, 3).join('\n') : undefined
      }
    });
  } finally {
    const durationMs = Date.now() - startTime;
    if (status !== "FAIL") {
      log({
        stage: "AGENT_SUCCESS",
        message: agentName,
        data: {
          duration: durationMs,
          hasData: status === "SUCCESS"
        }
      });
    }
    return {
      status,
      data,
      _meta: {
        agentName,
        durationMs,
        timestamp: new Date().toISOString(),
        ...(error && { error }),
      },
    };
  }
}
