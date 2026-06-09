/**
 * DEPRECATED: Finnhub article ingestion is fully deprecated for macro cognition.
 * Do not use Finnhub news as a primary macro substrate.
 * This file remains only for historical/diagnostic purposes.
 */
import { ingestionController } from "./ingestion-controller.js";
import { log } from "../../../shared/utils/logger.js";

type FinnhubNewsItem = {
  id?: string;
  headline?: string;
  title?: string;
  summary?: string;
  description?: string;
  datetime?: number; // epoch seconds
  source?: string;
  url?: string;
  category?: string;
};

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function isNonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

export class FinnhubNewsAdapter {
  private intervalMs: number;
  private timeoutMs: number;
  private stopped = false;
  private timer?: NodeJS.Timeout;

  private retries: number;

  private apiKey: string | undefined;


  constructor(opts?: { intervalMs?: number; timeoutMs?: number; retries?: number }) {
    this.intervalMs = opts?.intervalMs ?? 5 * 60 * 1000;
    this.timeoutMs = opts?.timeoutMs ?? 12 * 1000;
    this.retries = opts?.retries ?? 3;

    this.apiKey = process.env.FINNHUB_API_KEY;

  }

  start() {
    // If missing API key: adapter stays disabled. Server boot MUST NOT fail.
    if (!this.apiKey || !this.apiKey.trim()) {
      log({
        stage: "FINNHUB_CONFIG_MISSING",
        message: "FINNHUB_API_KEY missing; FinnhubNewsAdapter disabled",
        data: { provider: "finnhub-news", category: "general" },
        level: "WARN"
      });
      return;
    }

    this.stopped = false;
    this.poll().catch((err) => {
      log({
        stage: "FINNHUB_POLL_START_ERROR",
        message: "FinnhubNewsAdapter poll loop failed to start",
        data: { error: err?.message },
        level: "ERROR"
      });
    });
  }

  stop() {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
  }

  private async poll() {
    if (this.stopped) return;

    const provider = "finnhub-news";
    const source = "finnhub-news";

    const timingStart = Date.now();

    log({
      stage: "FINNHUB_FETCH",
      message: "Fetching Finnhub news items",
      data: {
        provider,
        source,
        timing: { started_at_ms: timingStart }
      }
    });

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= this.retries; attempt++) {
      try {
        const json = await this.fetchJsonWithTimeoutAndRetries(attempt);

        log({
          stage: "FINNHUB_FETCH_SUCCESS",
          message: "Finnhub news fetch succeeded",
          data: {
            provider,
            source,
            attempt,
            timing: { duration_ms: Date.now() - timingStart }
          }
        });

        if (!Array.isArray(json)) {
          log({
            stage: "FINNHUB_FETCH_ERROR",
            level: "ERROR",
            message: "Finnhub returned non-array JSON; skipping processing this cycle",
            data: { provider, source, typeofJson: typeof json }
          });

          break;
        }

        const itemsParsed = this.mapItems(json);

        log({
          stage: "FINNHUB_ITEMS_PARSED",
          message: "Finnhub items normalized for ingestion",
          data: {
            provider,
            source,
            count: itemsParsed.length,
            sampleHeadline: itemsParsed[0]?.title ?? null
          }
        });

        if (itemsParsed.length > 0) {
          log({
            stage: "NEWS_INGESTION",
            message: "Ingesting Finnhub news payloads into staging (shadow partition)",
            data: {
              provider,
              source,
              count: itemsParsed.length,
              sampleHeadline: itemsParsed[0]?.title ?? null
            }
          });

          await ingestionController.ingest(provider, source, itemsParsed).catch((err: any) => {
            log({
              stage: "NEWS_INGESTION",
              message: "Finnhub events ingestion failed",
              level: "ERROR",
              data: { provider, source, error: err?.message }
            });
          });
        }

        lastError = null;
        break; // success path
      } catch (err: any) {
        lastError = err;
        log({
          stage: "FINNHUB_FETCH_ERROR",
          message: "Finnhub fetch failed (will retry if attempts remain)",
          level: "ERROR",
          data: {
            provider,
            source,
            attempt,
            error: err?.message,
            timing: { duration_ms: Date.now() - timingStart }
          }
        });

        if (attempt < this.retries) {
          // bounded retry backoff
          await sleep(250 * attempt);
          continue;
        }
      }
    }

    if (lastError) {
      log({
        stage: "FINNHUB_FETCH_ERROR",
        message: "Finnhub fetch failed after bounded retries; continuing next poll cycle",
        level: "ERROR",
        data: { provider, source, error: (lastError as any)?.message }
      });
    }

    this.timer = setTimeout(() => this.poll(), this.intervalMs);
  }

  private async fetchJsonWithTimeoutAndRetries(_attempt: number): Promise<any[]> {

    const today =
      new Date();

    const from =
      new Date(
        today.getTime() - 86400000
      )
        .toISOString()
        .split("T")[0];

    const to =
      today
        .toISOString()
        .split("T")[0];

    const endpoint =
      `https://finnhub.io/api/v1/news?category=forex&from=${from}&to=${to}&token=${this.apiKey ?? ""}`;

    const controller =
      new AbortController();

    const timeoutId =
      setTimeout(() => {
        controller.abort();
      }, this.timeoutMs);

    try {

      const response =
        await fetch(endpoint, {
          signal: controller.signal,
          headers: {
            "User-Agent":
              "Mozilla/5.0 FinnhubNewsBot"
          }
        });

      if (!response.ok) {
        throw new Error(
          `Finnhub HTTP ${response.status} ${response.statusText}`
        );
      }

      const json =
        await response.json();

      console.log(
        "FINNHUB RAW SAMPLE:",
        json?.[0]
      );

      return Array.isArray(json)
        ? json
        : [];

    } finally {

      clearTimeout(timeoutId);

    }
  }

  // Normalized canonical event shape:
  // {
  //   id, title, description, timestamp, source, url, category
  // }
  private mapItems(json: any[]): Array<{
    id: string;
    title: string;
    description: string;
    timestamp: string;
    source: string;
    url: string;
    category: string;
  }> {
    // Hard macro-only filtering guardrail:
    // Finnhub "company-news" often yields equity/company headlines that pollute macro cognition.
    // We only allow macro-relevant categories (or explicit macro keywords in the text).
    const ALLOWED_RAW_CATEGORIES = new Set([
      "forex",
      "economic",
      "economy",
      "central-bank",
      "fed",
      "rates",
      "macro",
    ]);

    const KEYWORD_MACRO_WHITELIST = [
      "cpi",
      "ppi",
      "nfp",
      "non-farm",
      "fomc",
      "rate decision",
      "interest rate",
      "central bank",
      "cb",
      "boj",
      "ecb",
      "gdp",
      "unemployment",
      "pmi",
      "options expiry",
      "opex",
      "opex",
      "yields",
      "yield",
      "dxy",
    ];

    const textLooksMacro = (s: string) => {
      const t = (s || "").toLowerCase();
      return KEYWORD_MACRO_WHITELIST.some((kw) => t.includes(kw));
    };
    const out: Array<{
      id: string;
      title: string;
      description: string;
      timestamp: string;
      source: string;
      url: string;
      category: string;
    }> = [];

    const nowIso = new Date().toISOString();
    function normalizeMacroCategory(
      text: string
    ): string | null {

      const t = text.toLowerCase();

      if (
        t.includes("fomc") ||
        t.includes("federal reserve")
      ) {
        return "FOMC";
      }

      if (
        t.includes("cpi") ||
        t.includes("inflation")
      ) {
        return "CPI";
      }

      if (
        t.includes("nonfarm") ||
        t.includes("nfp")
      ) {
        return "NFP";
      }

      if (
        t.includes("ecb")
      ) {
        return "ECB";
      }

      if (
        t.includes("boj")
      ) {
        return "BOJ";
      }

      if (
        t.includes("powell") ||
        t.includes("central bank")
      ) {
        return "CENTRAL_BANK_SPEECH";
      }

      if (
        t.includes("yield") ||
        t.includes("treasury")
      ) {
        return "YIELDS_SHOCK";
      }

      if (
        t.includes("gdp")
      ) {
        return "GDP";
      }

      if (
        t.includes("unemployment")
      ) {
        return "UNEMPLOYMENT";
      }

      if (
        t.includes("pmi")
      ) {
        return "PMI";
      }

      return null;
    }

    for (const item of json as FinnhubNewsItem[]) {
      const headline = (item?.headline ?? "").toString();
      const title = isNonEmptyString((item as any)?.title) ? ((item as any).title as string) : headline;

      const descriptionRaw = item?.summary ?? item?.description ?? "";
      const description = (descriptionRaw ?? "").toString();

      const source = (item?.source ?? "finnhub").toString();
      const url = (item?.url ?? "").toString();
      const rawCategory = (item?.category ?? "general").toString();
      const rawCategoryLower = String(rawCategory ?? "").toLowerCase();

      const headlineForGuard = `${headline} ${description}`.trim().toLowerCase();
      const allowedByCategory = ALLOWED_RAW_CATEGORIES.has(rawCategoryLower);
      const allowedByKeywords = textLooksMacro(headlineForGuard);

      // Hard filter: drop generic company/equity news unless it clearly references macro keywords.
      if (!allowedByCategory && !allowedByKeywords) {
        continue;
      }


      const normalizedCategory =
        normalizeMacroCategory(
          `${headline} ${description}`
        );

      if (!normalizedCategory) {
        continue;
      }

      const datetime = item?.datetime;
      const timestamp = typeof datetime === "number" && Number.isFinite(datetime)
        ? new Date(datetime * 1000).toISOString()
        : nowIso;

      const id =
        String(
          item?.id ||
          (isNonEmptyString(url) ? url : "") ||
          `${headline}_${datetime ?? ""}`
        ).replace(/\s+/g, "_");

      if (!isNonEmptyString(title) && !isNonEmptyString(description)) continue;
      if (!id.trim()) continue;

      out.push({
        id,
        title: (title ?? "").trim(),
        description: description.trim(),
        timestamp,
        source,
        url: url.trim(),
        category: normalizedCategory,
      });
    }

    return out;
  }
}

export default FinnhubNewsAdapter;
