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
        // console.log(
        //   "[LLM_AGENT]",
        //   agentType
        // );

        // console.log(
        //   "[LLM_PART_COUNT]",
        //   formattedContents[0].parts.length
        // );

        // console.log(
        //   "[LLM_FIRST_PART]",
        //   formattedContents[0].parts[0]
        // );
        result = await Promise.race([

          genAI.models.generateContent({ model: GEMINI_PRO_VISION, ...requestBody }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("LLM_TIMEOUT after 120s")), 120_000)
          ),
        ]);
        const usage = result?.usageMetadata;

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
