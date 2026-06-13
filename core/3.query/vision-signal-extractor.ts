import * as fs from "fs";
import * as path from "path";

/**
 * Represents a vision fact extracted from vision summary.
 * 
 * Philosophy: Trust the Vision LLM. Don't reinterpret.
 * Vision already produces structured facts. This extractor only:
 * 1. Tracks asset context
 * 2. Tracks timeframe context
 * 3. Removes markdown formatting
 * 4. Removes section headers
 * 5. Preserves fact text verbatim
 * 6. Converts fact → retrieval query
 */
export interface VisionFact {
  asset?: string;          // e.g., "DXY", "US10Y", "EURUSD"
  timeframe?: string;      // e.g., "daily", "weekly", "monthly"
  fact: string;            // Vision output, verbatim
  confidence?: number;     // 0.0-1.0
}

/**
 * Vision Fact Extractor
 * 
 * Extracts facts from vision summaries with minimal transformation.
 * 
 * Lane 2 = Current Market State
 * - Lane 0: Domain knowledge (pipeline concepts)
 * - Lane 1: Ontology concepts (canonical terms)
 * - Lane 2: Market state (vision facts) ← This extractor
 * 
 * READ-ONLY: Does not modify any source files.
 */
export class VisionFactExtractor {
  constructor() {}

  /**
   * Extract facts from vision summary text.
   * 
   * @param visionSummary - Raw vision output text
   * @returns Array of VisionFact objects
   */
  extractFacts(visionSummary: string): VisionFact[] {
    if (!visionSummary) return [];

    const facts: VisionFact[] = [];
    const lines = visionSummary.split('\n');

    let currentAsset = '';
    let currentTimeframe = '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // 1. Track asset context from headers
      const assetMatch = trimmed.match(/\*\*(DXY|US10Y|US20Y|US30Y|EURUSD|GBPUSD|USDJPY|Gold|Oil|BTC|ETH|SPX|NQ|ES|YM)\b[^*]*\*\*/i);
      if (assetMatch) {
        currentAsset = assetMatch[1].toUpperCase();
        continue;
      }

      // 2. Track timeframe context from headers
      const timeframeMatch = trimmed.match(/\*\*(Monthly|Weekly|Daily|H4|H1|M15|M5|M1)\*\*/i);
      if (timeframeMatch) {
        currentTimeframe = timeframeMatch[1].toLowerCase();
        continue;
      }

      // 3. Skip section headers (all-bold lines, markdown headers, label-only lines)
      if (/^\*\*[^*]+\*\*:?\s*$/.test(trimmed)) continue;
      if (/^#{1,6}\s/.test(trimmed)) continue;
      if (/^[-*]\s+\*\*[^*]+\*\*:\s*$/.test(trimmed)) continue;
      
      // Skip lines without bullet points (section headers without formatting)
      if (!trimmed.startsWith('-') && !trimmed.startsWith('*') && !trimmed.match(/^\*\*/)) {
        continue;
      }

      // 4. Clean markdown formatting, preserve content
      const factText = trimmed
        .replace(/^[-*]\s+/, '')           // Remove bullet points
        .replace(/\*\*/g, '')              // Remove bold markers
        .replace(/^[^:]+:\s*/, '')         // Remove label prefix (e.g., "DXY:")
        .trim();

      // 5. Skip empty or too-short lines
      if (factText.length < 5) continue;

      // 6. Extract fact verbatim
      facts.push({
        asset: currentAsset || undefined,
        timeframe: currentTimeframe || undefined,
        fact: factText,
        confidence: 0.9
      });
    }

    // Deduplicate based on asset+fact+timeframe
    const uniqueFacts = this.deduplicateFacts(facts);
    
    return uniqueFacts;
  }

  /**
   * Convert VisionFact to retrieval query string.
   * 
   * Format: "[asset] [signal] [timeframe]"
   * Example: "DXY bearish displacement daily"
   */
  factToQuery(fact: VisionFact): string {
    // Extract signal keywords from narrative fact
    const signal = this.extractSignal(fact.fact);
    return [fact.asset, signal, fact.timeframe]
      .filter(Boolean)
      .join(' ')
      .trim();
  }

  /**
   * Extract signal keywords from narrative fact text.
   * Converts long narrative facts into concise retrieval signals.
   * 
   * Example:
   * Input:  "The current daily candle is a small bearish candle, indicating a minor downward displacement..."
   * Output: "bearish displacement"
   */
  private extractSignal(fact: string): string {
    if (!fact) return '';

    // Priority 1: ICT-specific patterns
    const ictPatterns = [
      { regex: /bearish\s+(displacement|move|candle|pressure)/i, signal: 'bearish displacement' },
      { regex: /bullish\s+(displacement|move|candle|pressure)/i, signal: 'bullish displacement' },
      { regex: /(bearish|red)\s+(fvg|fair\s*value\s*gap)/i, signal: 'bearish FVG' },
      { regex: /(bullish|blue)\s+(fvg|fair\s*value\s*gap)/i, signal: 'bullish FVG' },
      { regex: /order\s*block/i, signal: 'order block' },
      { regex: /liquidity\s+(sweep|raid|grab)/i, signal: 'liquidity sweep' },
      { regex: /mitigation|mitigated/i, signal: 'mitigation' },
      { regex: /imbalance/i, signal: 'imbalance' },
    ];

    for (const { regex, signal } of ictPatterns) {
      if (regex.test(fact)) return signal;
    }

    // Priority 2: Macro-economic patterns
    const macroPatterns = [
      { regex: /yields?\s+(rising|climbing|increasing|higher)/i, signal: 'yields rising' },
      { regex: /yields?\s+(falling|dropping|decreasing|lower)/i, signal: 'yields falling' },
      { regex: /divergence/i, signal: 'divergence' },
      { regex: /correlation/i, signal: 'correlation' },
      { regex: /consolidat(ing|ion)/i, signal: 'consolidation' },
    ];

    for (const { regex, signal } of macroPatterns) {
      if (regex.test(fact)) return signal;
    }

    // Priority 3: Price action patterns
    const pricePatterns = [
      { regex: /break(ing|out)?\s+(above|below|through)/i, signal: 'breakout' },
      { regex: /(test|testing|retest)/i, signal: 'retest' },
      { regex: /bounce|bounced/i, signal: 'bounce' },
      { regex: /rejection/i, signal: 'rejection' },
      { regex: /support/i, signal: 'support' },
      { regex: /resistance/i, signal: 'resistance' },
    ];

    for (const { regex, signal } of pricePatterns) {
      if (regex.test(fact)) return signal;
    }

    // Fallback: Extract first meaningful phrase (max 40 chars)
    // Remove dates and parentheticals first
    const cleaned = fact
      .replace(/\([^)]*\)/g, '') // Remove (Apr 29, 2024)
      .replace(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/g, '') // Remove dates
      .trim();

    // Take first sentence or clause
    const firstClause = cleaned.split(/[.;,]|showing|indicating|suggesting/)[0].trim();
    
    // Limit to 40 chars
    return firstClause.length > 40 
      ? firstClause.slice(0, 40).trim()
      : firstClause;
  }

  /**
   * Convert all facts to query strings.
   */
  factsToQueries(facts: VisionFact[]): string[] {
    return facts.map(f => this.factToQuery(f));
  }

  /**
   * Deduplicate facts based on key fields.
   */
  private deduplicateFacts(facts: VisionFact[]): VisionFact[] {
    const seen = new Set<string>();
    const unique: VisionFact[] = [];

    for (const fact of facts) {
      const key = `${fact.asset || 'NONE'}|${fact.fact}|${fact.timeframe || 'NONE'}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(fact);
      }
    }

    return unique;
  }

  /**
   * Dump facts to JSON file for debugging.
   */
  dumpFacts(facts: VisionFact[], outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(facts, null, 2));
    console.log(`[VISION_FACT_EXTRACTOR] Dumped ${facts.length} facts to ${outputPath}`);
  }

  /**
   * Dump queries to JSON file for debugging.
   */
  dumpQueries(queries: string[], outputPath: string): void {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, JSON.stringify(queries, null, 2));
    console.log(`[VISION_FACT_EXTRACTOR] Dumped ${queries.length} queries to ${outputPath}`);
  }
}

// Singleton instance
export const visionFactExtractor = new VisionFactExtractor();