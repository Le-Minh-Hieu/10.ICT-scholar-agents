
import { runMasterOrchestrator, MasterOrchestratorInput } from "../core/3.query/orchestrators/master-orchestrator";
import { HierarchicalMemory } from "../shared/knowledge/hierarchical-types";
import { log } from "../shared/utils/logger";

async function testRelationalCognition() {
  console.log("🚀 Testing Phase 5: Relational Market Cognition\n");

  const mockMemory: HierarchicalMemory = {
    theses: {
      DAILY: {
        timeframe: "DAILY",
        bias: "suggests_bearish",
        confidence: 0.85,
        key_anchors: ["Weekly FVG", "Bearish Orderblock"],
        summary: "HTF is clearly bearish, looking for internal range liquidity.",
        supporting_chunks: []
      },
      M15: {
        timeframe: "M15",
        bias: "evidence_for_reversal",
        confidence: 0.9,
        key_anchors: ["LTF MSS", "FVG"],
        summary: "LTF showing bearish displacement after liquidity sweep.",
        supporting_chunks: []
      }
    },
    relational: {
      primary_asset: "EURUSD",
      external_influences: [
        {
          source_asset: "DXY",
          relationship: "INVERSE_CORRELATION",
          direction: "BULLISH_PRESSURE",
          confidence: 0.9,
          temporal_decay: 1.0
        }
      ],
      smt_hints: [
        {
          assets: ["EURUSD", "GBPUSD"],
          type: "BEARISH_SMT",
          divergence_type: "HH_VS_LH",
          confidence: 0.85,
          is_at_pd_array: true,
          notes: "GBPUSD failed to make a higher high while EURUSD did."
        }
      ],
      overall_relational_alignment: 0.88
    }
  };

  const input: MasterOrchestratorInput = {
    time: { trading_window: "active", timing_bias: "bullish" },
    htf: { htf_bias: "bearish", confidence: "high", reasoning: "HTF Bearish Structure" },
    itf: { itf_bias: "bearish", setup_type: "reversal" },
    ltf: { execute: true, direction: "bearish", entry: "FVG", confluence_score: 8 },
    memory: mockMemory
  };

  console.log("Case 1: Standard Inverse Correlation + SMT Confirmation");
  const result = await runMasterOrchestrator(input);
  console.log("Result:", JSON.stringify({
    execute: result.execute,
    direction: result.direction,
    confidence: result.confidence,
    score: result.score
  }, null, 2));
  console.log("Notes Snippet:", result.notes.slice(0, 200) + "...\n");

  console.log("Case 2: Correlation Collapse (DXY Bullish + EURUSD Bullish Setup)");
  const collapseMemory = { ...mockMemory };
  collapseMemory.relational = {
    ...mockMemory.relational!,
    external_influences: [
      {
        source_asset: "DXY",
        relationship: "INVERSE_CORRELATION",
        direction: "BEARISH_PRESSURE", // Conflict: DXY bearish should be BULLISH pressure for EURUSD, but we have a bearish setup
        confidence: 0.9,
        temporal_decay: 1.0
      }
    ]
  };

  const result2 = await runMasterOrchestrator({ ...input, memory: collapseMemory });
  console.log("Result (Collapsed):", JSON.stringify({
    execute: result2.execute,
    direction: result2.direction,
    confidence: result2.confidence,
    score: result2.score
  }, null, 2));
}

testRelationalCognition().catch(console.error);
