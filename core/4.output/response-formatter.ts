import { MasterOutput } from "../../shared/contracts/canonical.js";
import { QueryIntent } from "../3.query/query-understander";

/**
 * Formats the raw orchestrator output into the standardized MasterOutput schema.
 * Explicitly maps fields to avoid leaking internal raw structures.
 */
export function formatResponse(
  raw: MasterOutput, // Now expect the canonical MasterOutput
  query: string,
  startTime: number,
  intent?: QueryIntent
): MasterOutput {
  const endTime = Date.now();
  const processingTime = endTime - startTime;

  // The raw output from the orchestrator should already be in the correct format.
  // This function will now primarily be responsible for adding metadata.

  const formatted: MasterOutput = {
    ...raw,
    metadata: {
      ...raw.metadata,
      query,
      timestamp: new Date().toISOString(),
      processing_time_ms: processingTime,
      intent,
    },
  };

  // Clean up internal-only fields if they are not desired in the final output
  // For now, we will leave them, as the schema marks them as optional.

  return formatted;
}
