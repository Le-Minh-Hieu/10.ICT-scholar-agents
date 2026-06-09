export const normalizeDirection = (d: string): string => {
  const lower = d.toLowerCase();
  if ([ "long", "buy", "up", "positive", "optimistic"].includes(lower)) return "bullish";
  if ([ "short", "sell", "down", "negative", "pessimistic"].includes(lower)) return "bearish";
  return lower; // Return lowercased original if no match, for Zod to validate
}
