/// <reference types="node" />

import "dotenv/config";
import { log } from "../../../shared/utils/logger.js";
import { sessionAgent } from "../agents/time/session-agent.js";
import { macroTimeAgent } from "../agents/time/macro-time-agent.js";
import { monthlyAgent } from "../agents/time/monthly-agent.js";
import { weeklyAgent } from "../agents/time/weekly-agent.js";
import { dailyAgent } from "../agents/time/daily-agent.js";
import { quarterlyAgent } from "../agents/time/quarterly-agent.js";
import { StorageService } from "../../../shared/services/storage-service.js";
import { averageConfidence } from "../../../shared/utils/confidence-utils";
import { TimeAgentOutput as AgentTimeAgentOutput } from "../../../types/time-agent.js";
import { HydrationContext } from "../../../shared/contracts/context.js";
import { TimeOrchestratorOutput } from "../../../shared/contracts/time/time-orchestrator-output";

type AgentResult = AgentTimeAgentOutput | null;

interface TimeOrchestratorInput {
  eurusd: {
    m?: string;
    w?: string;
    d?: string;
    h4?: string;
    h1?: string;
    m15?: string;
    m5?: string;
    m1?: string;
  };
}

// Helper to ensure expectation is valid or return null
function safeExpectation(e: any): TimeOrchestratorOutput["expectation"] | null {
  const valid = [
    "Accumulation",
    "Re-accumulation",
    "Consolidation",
    "Manipulation",
    "Reversal",
    "Expansion",
    "Distribution",
    "Re-distribution",
    "Retracement",
  ];
  return valid.includes(e) ? e : null;
}

export async function runTimeOrchestrator(
  input: TimeOrchestratorInput,
  hydrationContext: HydrationContext
): Promise<TimeOrchestratorOutput> {
  log({ stage: "TIME_ORCHESTRATOR", message: "Starting Time Orchestrator", data: { input } });
  const { eurusd } = input;

  // Execute all agents
  const results = await Promise.allSettled([
    sessionAgent(
      { eurusd: { tf1: eurusd.h1 || null, tf2: eurusd.m15 || null, tf3: eurusd.m5 || null } },
      hydrationContext
    ),
    dailyAgent(
      { eurusd: { tf1: eurusd.d || null, tf2: eurusd.h4 || null, tf3: eurusd.h1 || null } },
      hydrationContext
    ),
    weeklyAgent(
      { eurusd: { tf1: eurusd.w || null, tf2: eurusd.d || null, tf3: eurusd.h4 || null } },
      hydrationContext
    ),
    monthlyAgent(
      { eurusd: { tf1: eurusd.m || null, tf2: eurusd.w || null, tf3: eurusd.d || null } },
      hydrationContext
    ),
    quarterlyAgent(
      { eurusd: { tf1: eurusd.m || null, tf2: eurusd.w || null, tf3: eurusd.d || null } },
      hydrationContext
    ),
    macroTimeAgent(
      { eurusd: { tf1: eurusd.m || null, tf2: eurusd.w || null, tf3: eurusd.d || null } },
      hydrationContext
    ),
  ]);

  const session: AgentResult = results[0].status === "fulfilled" ? results[0].value as AgentResult : null;
  const daily: AgentResult = results[1].status === "fulfilled" ? results[1].value as AgentResult : null;
  const weekly: AgentResult = results[2].status === "fulfilled" ? results[2].value as AgentResult : null;
  const monthly: AgentResult = results[3].status === "fulfilled" ? results[3].value as AgentResult : null;
  const quarterly: AgentResult = results[4].status === "fulfilled" ? results[4].value as AgentResult : null;
  const macro: AgentResult = results[5].status === "fulfilled" ? results[5].value as AgentResult : null;

  // Check if all agent results are null
  if (results.every(result => result.status === "fulfilled" && result.value === null)) {
    log({ stage: "TIME_ORCHESTRATOR", message: "Warning: All time agents returned null. This may indicate missing data for the input symbol.", level: "WARN" });
  }

  // --- PRIORITY WEIGHT ---
  const scoreMap = { favorable: 1, neutral: 0, unfavorable: -1 };

  const signals = [
    { name: "macro", weight: 3, bias: macro?.timing_bias },
    { name: "quarterly", weight: 3, bias: quarterly?.timing_bias },
    { name: "monthly", weight: 2, bias: monthly?.timing_bias },
    { name: "weekly", weight: 2, bias: weekly?.timing_bias },
    { name: "daily", weight: 1, bias: daily?.timing_bias },
    { name: "session", weight: 1, bias: session?.timing_bias },
  ];

  let totalScore = 0;
  let totalWeight = 0;

  for (const s of signals) {
    if (!s.bias || !(s.bias in scoreMap)) continue;
    totalScore += scoreMap[s.bias as keyof typeof scoreMap] * s.weight;
    totalWeight += s.weight;
  }

  const avgScore = totalWeight ? totalScore / totalWeight : 0;

  // --- DERIVE TIMING BIAS ---
  let timing_bias: "favorable" | "neutral" | "unfavorable" = "neutral";

  if (avgScore > 0.3) timing_bias = "favorable";
  else if (avgScore < -0.3) timing_bias = "unfavorable";

  // --- DERIVE TRADING WINDOW ---
  let trading_window: "active" | "inactive" = "active";

  if (
    session?.trading_window === "inactive" ||
    timing_bias === "unfavorable"
  ) {
    trading_window = "inactive";
  }

  // --- EXPECTATION ---
  const expectation =
    safeExpectation(macro?.expectation) ||
    safeExpectation(monthly?.expectation) ||
    safeExpectation(weekly?.expectation) ||
    safeExpectation(daily?.expectation) ||
    safeExpectation(session?.expectation) ||
    "none";

  // --- CONFIDENCE ---
  const confidence = averageConfidence([
    macro?.confidence,
    quarterly?.confidence,
    monthly?.confidence,
    weekly?.confidence,
    daily?.confidence,
    session?.confidence,
  ]);

  // --- NARRATIVE ---
  const narrative = `TIME DECISION:

* trading_window: ${trading_window}
* timing_bias: ${timing_bias}
* expectation: ${expectation}
* score: ${avgScore.toFixed(2)}`;

  const result: TimeOrchestratorOutput = {
    trading_window,
    timing_bias,
    expectation,
    confidence,
    narrative,
    _debug: {
      session,
      daily,
      weekly,
      monthly,
      quarterly,
      macro,
    },
  };

  log({ stage: "TIME_ORCHESTRATOR", message: "Time Orchestrator complete", data: {
    trading_window,
    timing_bias
  } });

  StorageService.persistAnalysisOutput('time', 'time-orchestrator', result);

  return result;
}
