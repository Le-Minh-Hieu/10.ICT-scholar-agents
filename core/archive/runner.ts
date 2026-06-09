import { getActiveWindow } from "../../app/orchestrator/getActiveWindow";
import { MacroReleaseEvent } from "../../types/macro";

export async function selectShadowCandidates(now = new Date()): Promise<MacroReleaseEvent[]> {
  const active = await getActiveWindow(now);
  // In a full implementation we'd filter already-reasoned events, gating, cooldowns, clustering, etc.
  // For this prototype return the active events array.
  return active;
}
