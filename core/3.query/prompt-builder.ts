import { HydrationContext } from "../../shared/contracts/context.js";
import { log } from "../../shared/utils/logger.js";

interface PromptBuildConfig {
  role: string;
  task: string;
  groundedKnowledge?: string;
  inputContext: string;
  constraints: string[];
  outputFormat: string;
}

export function buildPrompt(config: PromptBuildConfig, hydrationContext?: HydrationContext): string {
  const anchorContext = buildAnchorContext(hydrationContext);
  
  const prompt = `
## ROLE
${config.role}

## TASK
${config.task}
${anchorContext}
## GROUNDED KNOWLEDGE
${config.groundedKnowledge || "No grounded knowledge provided."}

## INPUT CONTEXT
${config.inputContext}

## CONSTRAINTS
${config.constraints.map(c => `- ${c}`).join("\n")}

## OUTPUT FORMAT
${config.outputFormat}
  `.trim();

  log({ stage: "PROMPT_BUILDER", message: "Prompt constructed", data: { prompt } });
  return prompt;
}

function buildAnchorContext(hydrationContext?: HydrationContext): string {
    if (!hydrationContext?.parent_thesis) {
        return "";
    }
    const parentThesis = hydrationContext.parent_thesis;
    return `
## PROBABILISTIC CONTEXT ANCHOR (FROM ${parentThesis.timeframe})
- Suggested Bias: ${parentThesis.bias} (Confidence: ${parentThesis.confidence})
- Summary: ${parentThesis.summary}
- Key Anchors: ${parentThesis.key_anchors.join(", ")}
- Shift Conditions: ${parentThesis.shift_conditions || "None provided"}

IMPORTANT: This is a contextual anchor, NOT an absolute truth. Look for evidence that aligns with this anchor, but also actively seek signals that might indicate a local reversal or retracement against it.
`
}
