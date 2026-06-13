/// <reference types="node" />

import "dotenv/config";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import pLimit from "p-limit";
import { log } from "./logger.js";
import { GoogleGenAI } from "@google/genai";
import { z, ZodSchema, ZodObject } from "zod";
import { zodToToolSchema } from "./zod-to-tool.js";
import { normalizeDirection } from "./normalizer.js";
import OpenAI from "openai";
import { 
  getFailoverChain, 
  recordExecutionResult, 
  loadReliabilityDb, 
  calculateReliabilityScore,
  getOpenRouterModels
} from "./openrouter-router.js";

let openRouterClient: any = null;
function getOpenRouterClient() {
  if (!openRouterClient) {
    const apiKey = process.env.OPENROUTER_API_KEY || "";
    openRouterClient = new OpenAI({
      baseURL: "https://openrouter.ai/api/v1",
      apiKey: apiKey,
      defaultHeaders: {
        "HTTP-Referer": "https://github.com/Le-Minh-Hieu/10.ICT-scholar-agents",
        "X-Title": "ICT Scholar Agents",
      }
    });
  }
  return openRouterClient;
}

const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT;
const LOCATION = process.env.GOOGLE_CLOUD_LOCATION;

const GEMINI_PRO_VISION = "gemini-2.5-flash";

let callCounter = 0;

const MAX_CONCURRENCY =
  Number(process.env.LLM_MAX_CONCURRENCY ?? 3);

const llmLimiter = pLimit(MAX_CONCURRENCY);

export interface LLMTelemetry {
  prompt_size_chars: number;
  estimated_prompt_tokens: number;
  estimated_completion_tokens: number;
  retry_count: number;
  validation_errors: Array<{ attempt: number; error: any }>;
  exact_prompt: string;
  raw_tool_args: string;
}

export interface LLMCLOptions {
  tools?: Array<{
    functionDeclarations: Array<{
      name: string;
      description?: string;
      parameters: {
        type: string;
        properties: Record<string, any>;
        required?: string[];
      };
    }>;
  }>;
  useStructured?: boolean;
  schema?: ZodSchema<any>;
  responseType?: "json" | "text";
  returnTelemetry?: boolean;
}

function safeParse(raw: string): any {
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (e) {
    throw e;
  }
}

function isSafeZodObject(schema: ZodSchema<any>): schema is ZodObject<any> {
  // Converter only supports plain z.object(...) schemas.
  return schema instanceof z.ZodObject;
}

export async function callLLM(
  prompt: string,
  agentType: string,
  callId: string,
  contents: any[],
  options: LLMCLOptions = {}
): Promise<any> {
  const maxRetries = 3;
  let retryCount = 0;
  let lastError: any = null;
  const validationErrors: Array<{ attempt: number; error: any }> = [];
  let finalExactPrompt = "";

  function generateSimpleErrorPrompt(error: any): string {
    if (error instanceof z.ZodError) {
      const issues = error.issues
        .map(
          (issue) =>
            `  - Path: ${issue.path.join(".")}, Expected: ${issue.message}`
        )
        .join("\n");
      return `Your previous response failed schema validation with the following issues:\n${issues}\n\nPlease correct these fields and try again.`;
    } else if (error instanceof SyntaxError) {
      return `Your previous response was not valid JSON. Please return only valid JSON.`;
    }

    return "Your previous response failed. Please try again.";
  }
  const genAI = new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION,
  });

  const executeLogicalCall = async () => {
    while (retryCount <= maxRetries) {
      const startTime = performance.now();
      callCounter++;
      const currentCallId = `${agentType}-${callId}-${callCounter}`;
      let activeModelUsed = "";


      if (!PROJECT_ID || !LOCATION) {
        throw new Error(
          "GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION must be set in .env file for Vertex AI"
        );
      }

      const toolCallingEnabled = !!(options.schema && isSafeZodObject(options.schema));

      const retryInstruction = toolCallingEnabled
        ? `You MUST call the 'output' function with args matching the schema exactly.`
        : `Return valid JSON matching the schema. No markdown fences. No extra text.`;

      const currentPrompt =
        retryCount > 0
          ? `${prompt}\n\nIMPORTANT: ${generateSimpleErrorPrompt(lastError)} ${retryInstruction}`
          : prompt;
      if (process.env.LLM_DEBUG_DUMP === "true") {
        const dumpDir = path.join(
          process.cwd(),
          "data",
          "llm-debug"
        );

        fs.mkdirSync(dumpDir, { recursive: true });

        fs.writeFileSync(
          path.join(
            dumpDir,
            `${Date.now()}-${agentType}-PROMPT.txt`
          ),
          currentPrompt,
          "utf8"
        );
      }
      finalExactPrompt = currentPrompt;

      const promptHash = crypto
        .createHash("sha256")
        .update(currentPrompt)
        .digest("hex");

      const promptPreview =
        currentPrompt.substring(0, 500) +
        (currentPrompt.length > 500 ? "..." : "");

      log({
        stage: "LLM_TRACE",
        message: `Starting LLM call for ${agentType}${retryCount > 0 ? ` (Retry ${retryCount}/${maxRetries})` : ""
          }`,
        data: {
          currentCallId,
          agentType,
          retry_attempt: retryCount,
          max_retries: maxRetries,
          prompt_hash: promptHash,
          prompt_preview: promptPreview,
        },
      });

      const formattedContents = [
        {
          role: "user",
          parts: contents
            .map((p) => {
              if (p.text) {
                return {
                  text:
                    retryCount > 0 && contents.indexOf(p) === 0
                      ? currentPrompt
                      : p.text,
                };
              }
              if (p.inlineData) {
                return {
                  inlineData: {
                    mimeType: p.inlineData.mimeType,
                    data: p.inlineData.data,
                  },
                };
              }
              return null;
            })
            .filter(Boolean),
        },
      ];

      const requestBody: any = {
        contents: formattedContents,
        generationConfig: {
          temperature: 0.1,
        },
      };

      if (toolCallingEnabled) {
        requestBody.tools = [
          {
            functionDeclarations: [
              {
                name: "output",
                description: "Return output matching the provided schema.",
                parameters: zodToToolSchema(options.schema as any),
              },
            ],
          },
        ];
        requestBody.toolConfig = {
          functionCallingConfig: {
            mode: "REQUIRED",
          },
        };
      }

      // Manual tools override still works.
      if (options.tools && options.tools.length > 0) {
        requestBody.tools = options.tools;
        requestBody.toolConfig = {
          functionCallingConfig: {
            mode: "REQUIRED",
          },
        };
      }

      try {
        let result: any;
        const isVisionCall = agentType.toLowerCase().endsWith("-vision");
        const useOpenRouter = process.env.REASONING_PROVIDER === "openrouter" && !isVisionCall;

        if (useOpenRouter) {
          const apiKey = process.env.OPENROUTER_API_KEY || "";
          if (!apiKey) {
            throw new Error("OPENROUTER_API_KEY is not defined in environment variables");
          }

          const chain = await getFailoverChain(apiKey, {
            schema: options.schema,
            tools: options.tools,
            responseType: options.responseType,
            estimatedPromptChars: currentPrompt.length,
          });

          let chatCompletion: any = null;
          let modelUsed = "";
          let apiCallSuccess = false;

          for (let idx = retryCount; idx < chain.length; idx++) {
            const currentModel = chain[idx];
            modelUsed = currentModel;
            const opStartTime = performance.now();
            try {
              const client = getOpenRouterClient();
              const messages: any[] = formattedContents.map(msg => {
                const parts = msg.parts.map((part: any) => {
                  if (part && part.text) return { type: "text" as const, text: part.text };
                  return null;
                }).filter(Boolean);
                return {
                  role: msg.role === "model" ? ("assistant" as const) : ("user" as const),
                  content: parts.length === 1 && parts[0]?.type === "text" ? parts[0].text : parts
                };
              });

              const openaiParams: any = {
                model: currentModel,
                messages,
                temperature: 0.1,
                max_tokens: 4000,
              };

              if (toolCallingEnabled) {
                openaiParams.tools = [
                  {
                    type: "function" as const,
                    function: {
                      name: "output",
                      description: "Return output matching the provided schema.",
                      parameters: zodToToolSchema(options.schema as any),
                    }
                  }
                ];
                openaiParams.tool_choice = { type: "function" as const, function: { name: "output" } };
              } else if (options.tools && options.tools.length > 0) {
                openaiParams.tools = options.tools.map((t: any) => {
                  const decl = t.functionDeclarations?.[0];
                  return {
                    type: "function" as const,
                    function: {
                      name: decl.name,
                      description: decl.description || "Return structured output",
                      parameters: decl.parameters
                    }
                  };
                });
                openaiParams.tool_choice = { type: "function" as const, function: { name: openaiParams.tools[0].function.name } };
              }

              if (options.responseType === "json" && !openaiParams.tools) {
                openaiParams.response_format = { type: "json_object" };
              }

              const completionPromise = client.chat.completions.create(openaiParams);
              chatCompletion = await Promise.race([
                completionPromise,
                new Promise((_, reject) =>
                  setTimeout(() => reject(new Error("LLM_TIMEOUT after 120s")), 120_000)
                )
              ]);

              apiCallSuccess = true;
              activeModelUsed = modelUsed;
              break;

            } catch (err: any) {
              const opLatency = performance.now() - opStartTime;
              let errorType: any = "provider_error";
              if (err.message && err.message.includes("TIMEOUT")) {
                errorType = "timeout";
              }
              recordExecutionResult(currentModel, false, opLatency, errorType);
              log({
                stage: "LLM_PROVIDER_FAILOVER",
                message: `Provider error for model ${currentModel}: ${err.message || String(err)}. Trying next candidate...`,
                level: "WARN"
              });
            }
          }

          if (apiCallSuccess && chatCompletion) {
            const choice = chatCompletion.choices?.[0];
            const toolCall = choice?.message?.tool_calls?.[0];

            result = {
              candidates: [
                {
                  content: {
                    parts: [
                      toolCall ? {
                        functionCall: {
                          name: toolCall.function.name,
                          args: JSON.parse(toolCall.function.arguments)
                        }
                      } : {
                        text: choice?.message?.content || ""
                      }
                    ]
                  },
                  finishReason: choice?.finish_reason?.toUpperCase() || "STOP"
                }
              ],
              usageMetadata: {
                promptTokenCount: chatCompletion.usage?.prompt_tokens || 0,
                candidatesTokenCount: chatCompletion.usage?.completion_tokens || 0,
                totalTokenCount: chatCompletion.usage?.total_tokens || 0
              }
            };
          } else {
            log({
              stage: "LLM_OPENROUTER_EXHAUSTED",
              message: "All OpenRouter models failed. Falling back to Gemini Vertex AI.",
              level: "WARN"
            });
            result = await Promise.race([
              genAI.models.generateContent({ model: GEMINI_PRO_VISION, ...requestBody }),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("LLM_TIMEOUT after 120s")), 120_000)
              ),
            ]);
          }
        } else {
          result = await Promise.race([
            genAI.models.generateContent({ model: GEMINI_PRO_VISION, ...requestBody }),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error("LLM_TIMEOUT after 120s")), 120_000)
            ),
          ]);
        }
        const usage = result?.usageMetadata;

        // Diagnostic shadow testing path: runs OpenRouter in parallel/sequence without affecting execution
        const runShadowFlow = async () => {
          if (isVisionCall) return;
          const shadowEnabled = process.env.OPENROUTER_SHADOW_MODE === "true" || process.env.SHADOW_OPENROUTER === "true";
          if (!shadowEnabled) return;
          if (Math.random() > Number(process.env.SHADOW_SAMPLE_RATE ?? 1.0)) return;

          try {
            const apiKey = process.env.OPENROUTER_API_KEY || "";
            if (!apiKey) return;

            const chain = await getFailoverChain(apiKey, {
              schema: options.schema,
              tools: options.tools,
              responseType: options.responseType,
              estimatedPromptChars: currentPrompt.length,
            });

            let shadowResult: any = null;
            let chosenModel = "";
            let shadowSuccess = false;
            let shadowErrorType: any = undefined;
            let shadowLatency = 0;
            let shadowCompletion: any = null;

            for (const model of chain) {
              chosenModel = model;
              const shadowStartTime = performance.now();
              try {
                const client = getOpenRouterClient();
                const messages: any[] = formattedContents.map(msg => {
                  const parts = msg.parts.map((part: any) => {
                    if (part && part.text) return { type: "text" as const, text: part.text };
                    return null;
                  }).filter(Boolean);
                  return {
                    role: msg.role === "model" ? ("assistant" as const) : ("user" as const),
                    content: parts.length === 1 && parts[0]?.type === "text" ? parts[0].text : parts
                  };
                });

                const openaiParams: any = {
                  model,
                  messages,
                  temperature: 0.1,
                  max_tokens: 4000,
                };

                if (toolCallingEnabled) {
                  openaiParams.tools = [
                    {
                      type: "function" as const,
                      function: {
                        name: "output",
                        description: "Return output matching the provided schema.",
                        parameters: zodToToolSchema(options.schema as any),
                      }
                    }
                  ];
                  openaiParams.tool_choice = { type: "function" as const, function: { name: "output" } };
                } else if (options.tools && options.tools.length > 0) {
                  openaiParams.tools = options.tools.map((t: any) => {
                    const decl = t.functionDeclarations?.[0];
                    return {
                      type: "function" as const,
                      function: {
                        name: decl.name,
                        description: decl.description || "Return structured output",
                        parameters: decl.parameters
                      }
                    };
                  });
                  openaiParams.tool_choice = { type: "function" as const, function: { name: openaiParams.tools[0].function.name } };
                }

                if (options.responseType === "json" && !openaiParams.tools) {
                  openaiParams.response_format = { type: "json_object" };
                }

                const completionPromise = client.chat.completions.create(openaiParams);
                shadowCompletion = await Promise.race([
                  completionPromise,
                  new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("LLM_TIMEOUT after 120s")), 120_000)
                  )
                ]);

                const choice = shadowCompletion.choices?.[0];
                const toolCall = choice?.message?.tool_calls?.[0];
                let rawContent = "";
                let parsed: any = null;

                if (toolCall) {
                  rawContent = toolCall.function.arguments;
                  parsed = JSON.parse(rawContent);
                } else {
                  rawContent = choice?.message?.content || "";
                  if (options.responseType !== "text") {
                    parsed = safeParse(rawContent);
                  } else {
                    parsed = rawContent;
                  }
                }

                let outputToValidate = parsed;
                if (
                  outputToValidate &&
                  typeof outputToValidate === "object" &&
                  outputToValidate !== null &&
                  "direction" in outputToValidate &&
                  typeof outputToValidate.direction === "string"
                ) {
                  const normDir = normalizeDirection(outputToValidate.direction);
                  outputToValidate = { ...outputToValidate, direction: normDir };
                }

                if (options.schema) {
                  const validation = options.schema.safeParse(outputToValidate);
                  if (!validation.success) {
                    throw { type: "schema_failure", error: validation.error };
                  }
                  parsed = validation.data;
                }

                shadowResult = parsed || rawContent;
                shadowSuccess = true;
                shadowLatency = performance.now() - shadowStartTime;

                recordExecutionResult(model, true, shadowLatency);
                break;

              } catch (err: any) {
                shadowLatency = performance.now() - shadowStartTime;
                let parsedErrorType: any = "provider_error";

                if (err && err.type === "schema_failure") {
                  parsedErrorType = "schema_failure";
                } else if (err instanceof SyntaxError) {
                  parsedErrorType = "malformed_function_call";
                } else if (err.message && err.message.includes("TIMEOUT")) {
                  parsedErrorType = "timeout";
                }

                recordExecutionResult(model, false, shadowLatency, parsedErrorType);
                log({
                  stage: "SHADOW_FAILOVER_CHAIN_ERROR",
                  message: `Shadow run failed for model ${model}: ${err.message || String(err)}`,
                  level: "WARN"
                });
              }
            }

            const shadowDir = path.join(process.cwd(), "data", "shadow-debug");
            fs.mkdirSync(shadowDir, { recursive: true });

            const geminiParsed = result?.candidates?.[0]?.content?.parts?.[0]?.functionCall
              ? result.candidates[0].content.parts[0].functionCall.args
              : safeParse(result?.candidates?.[0]?.content?.parts?.[0]?.text || "{}");

            const promptPrice = shadowCompletion?.usage?.prompt_tokens ? 0.000001 : 0;
            const compPrice = shadowCompletion?.usage?.completion_tokens ? 0.000002 : 0;
            const shadowCost = (shadowCompletion?.usage?.prompt_tokens || 0) * promptPrice + (shadowCompletion?.usage?.completion_tokens || 0) * compPrice;

            const comparison = {
              timestamp: new Date().toISOString(),
              agentType,
              currentCallId,
              prompt: currentPrompt,
              gemini: {
                raw: result,
                parsed: geminiParsed,
                latency: performance.now() - startTime,
                telemetry: {
                  promptTokens: usage?.promptTokenCount || 0,
                  completionTokens: usage?.candidatesTokenCount || 0,
                  totalTokens: usage?.totalTokenCount || 0
                }
              },
              openrouter: {
                modelUsed: chosenModel,
                success: shadowSuccess,
                parsed: shadowResult,
                latency: shadowLatency,
                telemetry: {
                  promptTokens: shadowCompletion?.usage?.prompt_tokens || 0,
                  completionTokens: shadowCompletion?.usage?.completion_tokens || 0,
                  totalTokens: shadowCompletion?.usage?.total_tokens || 0
                },
                estimatedCost: shadowCost,
              }
            };

            fs.writeFileSync(
              path.join(shadowDir, `shadow-${Date.now()}-${agentType}.json`),
              JSON.stringify(comparison, null, 2),
              "utf8"
            );

          } catch (shadowError: any) {
            log({
              stage: "SHADOW_OPENROUTER_ERROR",
              message: `Shadow OpenRouter pipeline error: ${shadowError.message}`,
              level: "WARN"
            });
          }
        };

        runShadowFlow().catch((e) => {
          log({
            stage: "SHADOW_FLOW_CRITICAL_FAIL",
            message: `Unhandled exception in async shadow task: ${e.message}`,
            level: "ERROR"
          });
        });

        log({
          stage: "TOKEN_USAGE",
          message: `Token usage for ${agentType}`,
          data: {
            currentCallId,
            agent: agentType,

            prompt_tokens: usage?.promptTokenCount ?? 0,
            completion_tokens: usage?.candidatesTokenCount ?? 0,
            total_tokens: usage?.totalTokenCount ?? 0,

            thoughts_tokens: usage?.thoughtsTokenCount ?? 0,
            tool_tokens: usage?.toolUsePromptTokenCount ?? 0,
            cached_tokens: usage?.cachedContentTokenCount ?? 0,

            prompt_details: usage?.promptTokensDetails ?? [],
            completion_details: usage?.candidatesTokensDetails ?? []
          }
        });
        log({
          stage: "TOKEN_AUDIT",
          message: "Cost audit",
          data: {
            agent: agentType,
            prompt: usage?.promptTokenCount,
            output: usage?.candidatesTokenCount,
            total: usage?.totalTokenCount,
            thoughts: usage?.thoughtsTokenCount
          }
        });
        const endTime = performance.now();
        const modelGenerationTime = endTime - startTime;

        log({
          stage: "LLM_TRACE",
          message: `LLM Response received for ${agentType}`,
          data: {
            currentCallId,
            candidates:
              result?.candidates && result.candidates.length
                ? result.candidates.length
                : 0,
            finishReason:
              result?.candidates?.[0]?.finishReason ?? "UNKNOWN",
            model_generation_time_ms: modelGenerationTime,
          },
        });

        if (result?.promptFeedback?.blockReason) {
          throw new Error(`Content was blocked: ${result.promptFeedback.blockReason}`);
        }

        const part =
          result?.candidates?.[0]?.content?.parts?.[0] ?? null;

        if (!part) {
          throw new Error(
            "Invalid LLM response structure: " + JSON.stringify(result)
          );
        }

        let rawResponse = "";
        let parsedOutput: any = null;
        let parseError: string | null = null;

        try {
          if (part.functionCall) {
            rawResponse = JSON.stringify(part.functionCall.args);
            parsedOutput = part.functionCall.args;
          } else {
            rawResponse = part.text || "";
            if (options.responseType === "text") {
              if (options.returnTelemetry) {
                const promptChars = finalExactPrompt.length;
                const completionChars = rawResponse.length;
                const usage = result?.usageMetadata;
                if (activeModelUsed) {
                  recordExecutionResult(activeModelUsed, true, performance.now() - startTime);
                }
                return {
                  data: rawResponse,
                  telemetry: {
                    prompt_size_chars: promptChars,
                    telemetry: {
                      prompt_size_chars: promptChars,

                      actual_prompt_tokens:
                        usage?.promptTokenCount ?? 0,

                      actual_completion_tokens:
                        usage?.candidatesTokenCount ?? 0,

                      actual_total_tokens:
                        usage?.totalTokenCount ?? 0,

                      thoughts_tokens:
                        usage?.thoughtsTokenCount ?? 0,

                      retry_count: retryCount,

                      validation_errors: validationErrors,

                      exact_prompt: finalExactPrompt,

                      raw_tool_args: rawResponse
                    },
                    retry_count: retryCount,
                    validation_errors: validationErrors,
                    exact_prompt: finalExactPrompt,
                    raw_tool_args: rawResponse
                  }
                };
              }
              if (activeModelUsed) {
                recordExecutionResult(activeModelUsed, true, performance.now() - startTime);
              }
              return rawResponse;
            }
            parsedOutput = safeParse(rawResponse);
          }

          let outputToValidate = parsedOutput;

          if (
            outputToValidate &&
            typeof outputToValidate === "object" &&
            outputToValidate !== null &&
            "direction" in outputToValidate &&
            typeof outputToValidate.direction === "string"
          ) {
            const originalDirection = outputToValidate.direction;
            const newDirection = normalizeDirection(originalDirection);
            if (originalDirection !== newDirection) {
              log({
                stage: "ONTOLOGY_NORMALIZATION",
                message: "Normalized 'direction' value before validation.",
                data: {
                  agent: agentType,
                  original: originalDirection,
                  normalized: newDirection,
                },
              });
              outputToValidate = {
                ...outputToValidate,
                direction: newDirection,
              };
            }
          }

          if (options.schema) {
            const validation = options.schema.safeParse(outputToValidate);
            if (!validation.success) {
              lastError = validation.error;
              validationErrors.push({ attempt: retryCount + 1, error: validation.error.issues });
              
              if (activeModelUsed) {
                recordExecutionResult(activeModelUsed, false, performance.now() - startTime, "schema_failure");
              }

              log({
                stage: "LLM_VALIDATION_FAIL",
                message: "Schema validation failed",
                data: {
                  currentCallId,
                  retry_attempt: retryCount,
                  issues: validation.error.issues,
                },
                level: "WARN",
              });

              if (retryCount < maxRetries) {
                retryCount++;
                continue;
              }
              throw validation.error;
            }
            parsedOutput = validation.data;
          }
        } catch (e) {
          lastError = e;
          parseError = e instanceof Error ? e.message : String(e);

          if (activeModelUsed) {
            const isValidationError = e instanceof z.ZodError || (e && (e as any).type === "schema_failure");
            const errType = isValidationError ? "schema_failure" : "malformed_function_call";
            recordExecutionResult(activeModelUsed, false, performance.now() - startTime, errType);
          }

          log({
            stage: "LLM_PARSE_ERROR",
            message: "Failed to parse LLM output",
            data: {
              currentCallId,
              retry_attempt: retryCount,
              raw_preview: rawResponse.substring(0, 1000),
              error: parseError,
              RAW_RESPONSE: rawResponse,
              SANITIZED_RESPONSE: null,
              JSON_EXTRACTION_RESULT: null,
              VALIDATION_RESULT: null,
              PARSE_FAILURE_REASON: parseError,
            },
            level: "WARN",
          });

          if (retryCount < maxRetries) {
            retryCount++;
            continue;
          }
          throw e;
        }

        const responsePreview =
          rawResponse.substring(0, 500) +
          (rawResponse.length > 500 ? "..." : "");

        log({
          stage: "LLM_TRACE",
          message: `LLM Output processed for ${agentType}`,
          data: {
            agent: agentType,
            prompt_hash: promptHash,
            response_preview: responsePreview,
            success: !parseError,
          },
        });

        log({
          stage: "LLM_FULL_TRACE",
          message: `LLM Full Output for ${agentType}`,
          data: {
            currentCallId,
            parsed: parsedOutput,
            parse_error: parseError,
            RAW_RESPONSE: rawResponse,
            SANITIZED_RESPONSE: null,
            JSON_EXTRACTION_RESULT: null,
            VALIDATION_RESULT: options.schema
              ? options.schema.safeParse(parsedOutput)
              : null,
          },
        });
        if (process.env.LLM_DEBUG_DUMP === "true") {
          const dumpDir = path.join(
            process.cwd(),
            "data",
            "llm-debug"
          );

          fs.mkdirSync(dumpDir, { recursive: true });

          fs.writeFileSync(
            path.join(
              dumpDir,
              `${Date.now()}-${agentType}-RESPONSE.txt`
            ),
            typeof rawResponse === "string"
              ? rawResponse
              : JSON.stringify(rawResponse, null, 2),
            "utf8"
          );
        }
        const finalResult = parsedOutput || rawResponse;
        if (options.returnTelemetry) {
          const promptChars = finalExactPrompt.length;
          const completionChars = rawResponse.length;
          if (activeModelUsed) {
            recordExecutionResult(activeModelUsed, true, performance.now() - startTime);
          }
          return {
            data: finalResult,
            telemetry: {
              prompt_size_chars: promptChars,
              estimated_prompt_tokens: Math.ceil(promptChars / 4),
              estimated_completion_tokens: Math.ceil(completionChars / 4),
              retry_count: retryCount,
              validation_errors: validationErrors,
              exact_prompt: finalExactPrompt,
              raw_tool_args: rawResponse
            }
          };
        }
        if (activeModelUsed) {
          recordExecutionResult(activeModelUsed, true, performance.now() - startTime);
        }
        return finalResult;
      } catch (e) {
        lastError = e;
        log({
          stage: "LLM_RETRY_TRACE",
          message: `LLM Call failed`,
          data: {
            agentType,
            retry_attempt: retryCount,
            error: e instanceof Error ? e.message : String(e),
          },
          level: "WARN",
        });
        retryCount++;
      }
    }

    throw lastError || new Error(`LLM call failed after ${maxRetries} retries`);
  };
  const activeCount = (llmLimiter as any).activeCount;
  const pendingCount = (llmLimiter as any).pendingCount;

  if (activeCount >= MAX_CONCURRENCY) {
    log({
      stage: "LLM_QUEUE",
      message: "Request queued",
      data: {
        queued: true,
        activeCount,
        pendingCount,
        maxConcurrency: MAX_CONCURRENCY,
      }
    });
  }
  return llmLimiter(executeLogicalCall);
}
