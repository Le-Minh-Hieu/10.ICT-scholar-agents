import { z } from 'zod';
import {
  HTFOrchestratorOutput,
  ITFOrchestratorOutput,
  LTFOrchestratorOutput,
} from '../../shared/contracts/canonical';
import { MasterOrchestratorInput } from './orchestrators/master-orchestrator';
import { TimeOrchestratorOutput }
from '../../shared/contracts/time/time-orchestrator-output';
import {
  V1_ITF_INPUT_PAYLOAD,
  V1_LTF_INPUT_PAYLOAD,
  V1_MASTER_INPUT_PAYLOAD,
  PAYLOAD_VERSION,
} from '../../shared/contracts/payloads';
import { log } from '../../shared/utils/logger';
import { HydrationContext } from '../../shared/contracts/context';
import { PMSO } from '../../shared/contracts/pmso';
import { MasterOrchestratorInputSchema } from './orchestrators/master-orchestrator';
import { sanitizeForOrchestration } from './agents/shared/base-agent';

function summarizeReasoning(reasoning: string): string {
  if (!reasoning) return '';
  return reasoning.substring(0, 500) + (reasoning.length > 500 ? '...' : '');
}

export function buildITFInput(
  htfOutput: HTFOrchestratorOutput,
  hydrationContext: HydrationContext
): z.infer<typeof V1_ITF_INPUT_PAYLOAD> {
  const input = {
    version: PAYLOAD_VERSION,
    htf_bias: htfOutput.htf_bias,
    next_candle_bias: htfOutput.next_candle_bias,
    confidence: htfOutput.confidence,
    dominant_factors: htfOutput.dominant_factors,
    reasoning: htfOutput.reasoning,
    // hydration_context: hydrationContext,
  };
  log({ stage: 'PAYLOAD_BUILDER', message: 'Building ITF Input', data: { payload: input } });
  return V1_ITF_INPUT_PAYLOAD.parse(input);
}

export function buildLTFInput(
  itfInput: z.infer<typeof V1_ITF_INPUT_PAYLOAD>,
  itfOutput: ITFOrchestratorOutput,
  hydrationContext: HydrationContext
): z.infer<typeof V1_LTF_INPUT_PAYLOAD> {
  const input = {
    version: PAYLOAD_VERSION,
    htf_input: itfInput,
    itf_bias: itfOutput.itf_bias,
    entry_bias: itfOutput.entry_bias,
    setup_type: itfOutput.setup_type,
    confidence: itfOutput.confidence,
    dominant_factors: itfOutput.dominant_factors,
    reasoning: itfOutput.reasoning,
    // hydration_context: hydrationContext,
  };
  log({ stage: 'PAYLOAD_BUILDER', message: 'Building LTF Input', data: { payload: input } });
  try {
    return V1_LTF_INPUT_PAYLOAD.parse(input);
  } catch (error) {
    log({ stage: 'PAYLOAD_VALIDATION_FAILURE', message: 'LTF input validation failed', data: { error, payload: input }, level: 'ERROR' });
    throw error;
  }
}

export function buildMasterInput(
  htfOutput: HTFOrchestratorOutput,
  itfOutput: ITFOrchestratorOutput,
  ltfOutput: LTFOrchestratorOutput,
  timeOutput: TimeOrchestratorOutput,
  hydrationContext: HydrationContext
): MasterOrchestratorInput {
  // Fail-fast checks
  if (!htfOutput) {
    log({ stage: 'PAYLOAD_BUILDER', message: 'HTF output is missing when building Master Input', level: 'ERROR' });
    throw new Error('HTF output missing for Master Input');
  }
  if (!itfOutput) {
    log({ stage: 'PAYLOAD_BUILDER', message: 'ITF output is missing when building Master Input', level: 'ERROR' });
    throw new Error('ITF output missing for Master Input');
  }
  if (!ltfOutput) {
    log({ stage: 'PAYLOAD_BUILDER', message: 'LTF output is missing when building Master Input', level: 'ERROR' });
    throw new Error('LTF output missing for Master Input');
  }
  if (!timeOutput) {
    log({ stage: 'PAYLOAD_BUILDER', message: 'Time output is missing when building Master Input', level: 'ERROR' });
    throw new Error('Time output missing for Master Input');
  }

  const input = {
    time: timeOutput,
    htf: {
      ...htfOutput,
      _debug: undefined,
      _raw: undefined,
      compact_output: sanitizeForOrchestration((htfOutput as any).compact_output || htfOutput),
    },
    itf: {
      ...itfOutput,
      _debug: undefined,
      _raw: undefined,
      compact_output: sanitizeForOrchestration((itfOutput as any).compact_output || itfOutput),
    },
    ltf: {
      ...ltfOutput,
      _debug: undefined,
      _raw: undefined,
      compact_output: sanitizeForOrchestration((ltfOutput as any).compact_output || ltfOutput),
    },
    hydration_context: hydrationContext,
  };
  log({ stage: 'PAYLOAD_BUILDER', message: 'Building Master Input', data: { payload: input } });
  try {
    return MasterOrchestratorInputSchema.parse(input);
  } catch (error) {
    log({ stage: 'PAYLOAD_VALIDATION_FAILURE', message: 'Master input validation failed', data: { error, payload: input }, level: 'ERROR' });
    throw error;
  }
}
