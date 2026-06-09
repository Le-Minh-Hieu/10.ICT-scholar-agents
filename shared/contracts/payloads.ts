import { z } from 'zod';
import { BiasEnum, ConfidenceSchema, SetupTypeEnum, EntryBiasEnum } from './canonical';
import { HydrationContextSchema } from './context';

// =================================================================================
// VERSION 1.0.0 PAYLOADS
// =================================================================================

export const PAYLOAD_VERSION = '1.0.0';

// HTF -> ITF
export const V1_ITF_INPUT_PAYLOAD = z.object({
  version: z.literal(PAYLOAD_VERSION),
  htf_bias: BiasEnum,
  next_candle_bias: BiasEnum,
  confidence: ConfidenceSchema,
  dominant_factors: z.array(z.string()),
  reasoning: z.string()
});
export type V1_ITF_INPUT = z.infer<typeof V1_ITF_INPUT_PAYLOAD>;

// ITF -> LTF
export const V1_LTF_INPUT_PAYLOAD = z.object({
  version: z.literal(PAYLOAD_VERSION),
  htf_input: V1_ITF_INPUT_PAYLOAD,
  itf_bias: BiasEnum,
  entry_bias: EntryBiasEnum.optional(),
  setup_type: SetupTypeEnum,
  confidence: ConfidenceSchema,
  dominant_factors: z.array(z.string()),
  reasoning: z.string()
});
export type V1_LTF_INPUT = z.infer<typeof V1_LTF_INPUT_PAYLOAD>;

// LTF -> MASTER
export const V1_MASTER_INPUT_PAYLOAD = z.object({
  version: z.literal(PAYLOAD_VERSION),
  ltf_input: V1_LTF_INPUT_PAYLOAD,
  ltf: z.object({
    execute: z.boolean(),
    direction: BiasEnum,
    entry: z.string(),
    entry_price: z.number().nullable().optional(),
    stop_loss: z.number().nullable().optional(),
    take_profit: z.number().nullable().optional(),
    confluence_score: z.number().optional().default(0),
    confidence: ConfidenceSchema,
    dominant_factors: z.array(z.string()),
    reasoning: z.string(),
  }),
  time: z.any(), // Assuming time output is not bloated
  hydration_context: HydrationContextSchema,
});
export type V1_MASTER_INPUT = z.infer<typeof V1_MASTER_INPUT_PAYLOAD>;
