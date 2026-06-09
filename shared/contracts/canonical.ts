import { z } from 'zod';

// =================================================================================
// 1. SHARED ENUMS (The most basic, cross-cutting definitions)
// =================================================================================

export const BiasEnum = z.preprocess(v =>
  typeof v === "string" ? v.toLowerCase() : v,
  z.enum(["bullish", "bearish", "neutral", "long", "short"])
);

export type Bias = z.infer<typeof BiasEnum>;

export const EntryBiasEnum = z.enum(["bullish", "bearish", "none", "long", "short"]);
export type EntryBias = z.infer<typeof EntryBiasEnum>;

export const StateEnum = z.enum(["NO_TRADE", "WAIT_FOR_ENTRY", "READY"]);
export type State = z.infer<typeof StateEnum>;

// =================================================================================
// 2. CONFIDENCE (The most common shared object)
// =================================================================================

export const ConfidenceSchema = z.preprocess(
  (v) => {
    if (typeof v === 'object' && v !== null && 'confidence' in v && typeof v.confidence === 'number') {
      return v.confidence;
    }
    return v;
  },
  z.number().min(0).max(1)
);
export type Confidence = z.infer<typeof ConfidenceSchema>;

// =================================================================================
// Market Delivery State (Canonical additive object)
// =================================================================================

export const MarketDeliveryStateSchema = z.object({
  regime: z.enum(["bullish_delivery", "bearish_delivery"]).optional(),
  // Note: Additional fields are intentionally optional so only proven fields can be populated.
  paradigm: z.enum(["consolidation", "expansion", "retracement", "reversal"]).optional(),
  mmxm_phase: z.enum([
    "original_consolidation",
    "engineering_liquidity",
    "smart_money_reversal",
    "distribution",
  ]).optional(),
  macro_window: z.enum(["inactive", "pre_macro", "active_macro"]).optional(),
  confidence: z.number().optional(),
});

export type MarketDeliveryState = z.infer<typeof MarketDeliveryStateSchema>;


// =================================================================================
// 3. MASTER OUTPUT (The ultimate downstream contract)
// =================================================================================

export const MasterOutputSchema = z.object({
  decision: z.object({
    execute: z.boolean(),
    state: StateEnum,
    direction: BiasEnum,
    confidence: ConfidenceSchema,
    score: z.number().min(0).max(10),
    entry_zone: z.string(),
    notes: z.string(),
    target: z.string().optional(),
    stop_loss: z.string().optional(),
  }),
  layers: z.object({
    time: z.object({
      session: z.string(),
      timing_bias: z.string(),
      notes: z.string(),
    }),
    htf: z.object({
      bias: z.string(),
      state: z.string(),
      tradable: z.boolean(),
      pdArray: z.string(),
      equilibrium: z.number(),
      range_high: z.number(),
      range_low: z.number(),
      notes: z.string(),
    }),
    itf: z.object({
      direction: z.string(),
      valid: z.boolean(),
      notes: z.string(),
    }),
    ltf: z.object({
      direction: z.string(),
      execute: z.boolean(),
      entry: z.preprocess(
        v => v === null ? "none" : v,
        z.string()
      ),
      notes: z.string(),
    }),
    confluence: z.object({
      confirmed: z.boolean(),
      strength: z.number(),
      notes: z.string(),
    }),

    /**
     * Phase 4A: Macro/News visibility (first-class reasoning participant).
     * Injected from `news-modifier` via MasterOrchestrator.
     */
    macro_news: z
      .object({
        macro_context: z
          .object({
            active_event: z.string().optional(),
            phase: z.string().optional(),
            impact: z.string().optional(),
            expected_volatility: z.string().optional(),
            macro_bias: z.string().optional(),
            execution_modifier: z
              .object({
                reduce_size: z.boolean().optional(),
                avoid_pre_news_entry: z.boolean().optional(),
              })
              .optional(),
            confidence_modifier: z.number().optional(),
            narrative: z.any().optional(),
          })
          .optional(),

        risk_modifiers: z
          .object({
            uncertainty_pressure: z.number(),
            volatility_pressure: z.number(),
          })
          .optional(),

        macro_ire: z.any().optional(),
      })
      .optional(),
  }),
  metadata: z.object({
    query: z.string(),
    timestamp: z.string(),
    processing_time_ms: z.number(),
    intent: z.object({
      direction: z.enum(["long", "short", "neutral"]),
      asset: z.string().optional(),
    }).optional(),
    fallback_used: z.boolean().optional(),
    fallback_reason: z.string().optional(),
  }),
  vision: z.object({
    enabled: z.boolean(),
    analysis: z.string().optional(),
  }).optional(),
  _raw: z.any().optional(),
  _pmso: z.any().optional(),
  news_risk_modifier: z.object({
    uncertainty_pressure: z.number(),
    volatility_pressure: z.number()
  }).optional(),
  _debug: z.any().optional(),
  _confluence: z.any().optional(),
});
export type MasterOutput = z.infer<typeof MasterOutputSchema>;

// =================================================================================
// 4. ORCHESTRATOR OUTPUTS (Contracts for each major pipeline step)
// =================================================================================

export const HTFOrchestratorOutputSchema = z.object({
  /** The overall directional bias determined by the HTF analysis. */
  htf_bias: BiasEnum,
  /** The expected bias for the next candle (e.g., next daily candle). */
  next_candle_bias: BiasEnum,
  /** The confidence level in the htf_bias (0.0 to 1.0). */
  confidence: ConfidenceSchema,
  /** A list of the key market factors driving the HTF bias. */
  dominant_factors: z.preprocess((v) => {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      return Object.values(v).map(String);
    }
    return v;
  }, z.array(z.string())),
  /** A detailed explanation of the reasoning behind the HTF analysis. */
  reasoning: z.string(),
  /** The output of the HTF Structure agent. */
  structure_state: z.any().optional(),
  /** The output of the HTF Macro agent. */
  macro_state: z.any().optional(),
  /** The output of the HTF Liquidity agent. */
  liquidity_state: z.any().optional(),
  /** The output of the HTF PD Array agent. */
  pd_array_state: z.any().optional(),
  /** Debug information, including the raw outputs of the individual agents. */
  _debug: z.any().optional(),
  /** Raw output from the underlying LLM call for debugging. */
  _raw: z.any().optional(),
});
export type HTFOrchestratorOutput = z.infer<typeof HTFOrchestratorOutputSchema>;

export const SetupTypeEnum = z.enum(["continuation", "pullback", "reversal", "none"]);
export type SetupType = z.infer<typeof SetupTypeEnum>;

export const ITFOrchestratorOutputSchema = z.object({
  /** The overall directional bias determined by the ITF analysis. */
  itf_bias: BiasEnum,
  /** The bias for a potential trade entry (bullish, bearish, or none). */
  entry_bias: EntryBiasEnum,
  /** The type of trade setup identified (e.g., continuation, pullback, reversal). */
  setup_type: SetupTypeEnum,
  /** The confidence level in the itf_bias (0.0 to 1.0). */
  confidence: ConfidenceSchema,
  /** A list of the key market factors driving the ITF bias. */
  dominant_factors: z.preprocess((v) => {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      return Object.values(v).map(String);
    }
    return v;
  }, z.array(z.string())),
  /** A detailed explanation of the reasoning behind the ITF analysis. */
  reasoning: z.string(),
  /** The output of the ITF Structure agent. */
  structure: z.any().optional(),
  /** The output of the ITF Liquidity agent. */
  liquidity: z.any().optional(),
  /** The output of the ITF PD Array agent. */
  pd_array: z.any().optional(),
  /** The output of the ITF Setup agent. */
  setup: z.any().optional(),
  /** Debug information, including the raw outputs of the individual agents. */
  _debug: z.any().optional(),
  /** Raw output from the underlying LLM call for debugging. */
  _raw: z.any().optional(),
});
export type ITFOrchestratorOutput = z.infer<typeof ITFOrchestratorOutputSchema>;

const LTFOrchestratorOutputObject = z.object({
  /** Whether the LTF analysis provides a high-conviction signal to execute a trade. */
  execute: z.boolean(),
  /** The directional bias for the trade (bullish or bearish). */
  direction: BiasEnum,
  /** A description of the entry setup (e.g., "Entry at FVG after MSS"). */
  entry: z.preprocess(
    v => v === null ? "none" : v,
    z.string()
  ),
  /** The specific entry price for the trade. */
  entry_price: z.number().nullable().optional(),
  stop_loss: z.number().nullable().optional(),
  take_profit: z.number().nullable().optional(),
  /** A score representing the confluence of factors supporting the trade. */
  confluence_score: z.number().optional().default(0),
  /** The confidence level in the trade setup (0.0 to 1.0). */
  confidence: ConfidenceSchema,
  /** A list of the key factors supporting the trade. */
  dominant_factors: z.preprocess((v) => {
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      return Object.values(v).map(String);
    }
    return v;
  }, z.array(z.string())),
  /** A detailed explanation of the reasoning behind the trade setup. */
  reasoning: z.string(),
  /** Debug information, including the raw outputs of the individual agents. */
  _debug: z.any().optional(),
  /** Raw output from the underlying LLM call for debugging. */
  _raw: z.any().optional(),
  /** The chunks of text retrieved from the knowledge base to support the analysis. */
  retrieved_chunks: z.any().optional(),
});

export const LTFOrchestratorOutputSchema = LTFOrchestratorOutputObject.superRefine((data, ctx) => {
  if (data.execute) {
    if (!data.entry || data.entry === "none") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entry"],
        message: "Entry is required when execute is true."
      });
    }
    if (!data.entry_price) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["entry_price"],
        message: "Entry price is required when execute is true.",
      });
    }
    if (!data.stop_loss) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["stop_loss"],
        message: "Stop loss is required when execute is true.",
      });
    }
    if (!data.take_profit) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["take_profit"],
        message: "Take profit is required when execute is true.",
      });
    }
  }
});

export type LTFOrchestratorOutput = z.infer<typeof LTFOrchestratorOutputSchema>;

export { LTFOrchestratorOutputObject };

// =================================================================================
// 5. COMPRESSED INTER-ORCHESTRATOR PAYLOADS
// =================================================================================

export const CompressedITFInputSchema = z.object({
  htf_bias: BiasEnum,
  next_candle_bias: BiasEnum,
  confidence: ConfidenceSchema,
  dominant_factors: z.array(z.string()),
  reasoning_summary: z.string(),
});
export type CompressedITFInput = z.infer<typeof CompressedITFInputSchema>;

export const CompressedLTFInputSchema = z.object({
  htf: CompressedITFInputSchema,
  itf_bias: BiasEnum,
  entry_bias: EntryBiasEnum,
  setup_type: SetupTypeEnum,
  confidence: ConfidenceSchema,
  dominant_factors: z.array(z.string()),
  reasoning_summary: z.string(),
});
export type CompressedLTFInput = z.infer<typeof CompressedLTFInputSchema>;

export const CompressedMasterInputSchema = z.object({
  htf: CompressedITFInputSchema,
  itf: CompressedLTFInputSchema,
  ltf: z.object({
    execute: z.boolean(),
    direction: BiasEnum,
    entry: z.preprocess(
      v => v === null ? "none" : v,
      z.string()
    ),
    entry_price: z.number().optional(),
    stop_loss: z.number().optional(),
    take_profit: z.number().optional(),
    confluence_score: z.number().optional().default(0),
    confidence: ConfidenceSchema,
    dominant_factors: z.array(z.string()),
    reasoning_summary: z.string(),
  }),
  time: z.any(), // Assuming time output is not bloated
});
export type CompressedMasterInput = z.infer<typeof CompressedMasterInputSchema>;

// =================================================================================
// 6. CANONICAL EXAMPLES
// =================================================================================

export const MasterOutputExample: MasterOutput = {
  decision: {
    execute: false,
    state: "NO_TRADE",
    direction: "neutral",
    confidence: 0.5,
    score: 0,
    entry_zone: "N/A",
    notes: "No trade signal present.",
  },
  layers: {} as any, // Empty layers for example
  metadata: {} as any, // Empty metadata for example
};
