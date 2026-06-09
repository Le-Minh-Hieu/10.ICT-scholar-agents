export interface QueryIntent {
  direction: "long" | "short" | "neutral";
  asset?: string;
}

/**
 * Simple query parser to detect trading intent and direction.
 */
export function understandQuery(query: string): QueryIntent {
  const normalized = query.toLowerCase();
  
  let direction: "long" | "short" | "neutral" = "neutral";
  
  if (
    normalized.includes("long") || 
    normalized.includes("buy") || 
    normalized.includes("bullish") ||
    normalized.includes("call")
  ) {
    direction = "long";
  } else if (
    normalized.includes("short") || 
    normalized.includes("sell") || 
    normalized.includes("bearish") ||
    normalized.includes("put")
  ) {
    direction = "short";
  }

  // Basic asset detection (look for 6-letter uppercase-ish strings or common symbols)
  const assetMatch = query.match(/[A-Z]{3,}/) || query.match(/[a-z]{3,}/i);
  const asset = assetMatch ? assetMatch[0].toUpperCase() : undefined;

  return {
    direction,
    asset
  };
}
